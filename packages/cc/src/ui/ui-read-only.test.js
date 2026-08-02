import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderShell,
  renderInboxTable,
  renderCasesView,
  renderTasksView,
  renderStateBlock,
  countMutationControls,
} from './render.js';
import { createOpsReadClient, CC_NAV_ITEMS } from './ops-client.js';
import { createLocalCcServer } from './create-local-cc-server.js';

test('navigation has exactly three primary items', () => {
  assert.equal(CC_NAV_ITEMS.length, 3);
  assert.deepEqual(
    CC_NAV_ITEMS.map((n) => n.label),
    ['Inbox', 'Vorgänge', 'Aufgaben'],
  );
});

test('shell and views render without mutation controls or fake metrics', () => {
  const shell = renderShell({
    activeView: 'inbox',
    sessionLabel: 'synthetic-local-owner',
    opsBaseUrl: 'http://127.0.0.1:3099',
    mainHtml: renderInboxTable([
      {
        canonicalId: '1',
        canonicalRef: 'L-1',
        requestKind: 'LEAD',
        requestType: 'business_energy',
        createdAt: '2026-01-01',
        status: 'new',
        assignmentStatus: 'unassigned',
        contactRedacted: 'a***@example.test',
        source: '/unternehmen',
      },
    ]),
  });
  assert.match(shell, /DeinTarifHeld|Dein<span>Tarif<\/span>Held/);
  assert.match(shell, /Inbox/);
  assert.match(shell, /Vorgänge/);
  assert.match(shell, /Aufgaben/);
  assert.doesNotMatch(shell, /Dashboard|Provision|Marketing|Audit|Kill/);
  assert.equal(countMutationControls(shell), 0);
  assert.doesNotMatch(shell, /Conversion|KPI|Umsatz/);

  const cases = renderCasesView({
    items: [{ id: 'c1', case_ref: 'CASE-1', title: 'Test', status: 'open', created_at: 't' }],
    detail: {
      item: { title: 'Test', case_ref: 'CASE-1', status: 'open', created_at: 't' },
      notes: [{ canonical_resource_type: 'CASE_NOTE', body_preview: 'n', created_at: 't' }],
      assignments: [],
      statusHistory: [],
      communicationEvents: [],
    },
    selectedId: 'c1',
  });
  assert.match(cases, /Interne Notiz/);
  assert.match(cases, /CASE_NOTE/);
  assert.equal(countMutationControls(cases), 0);

  const tasks = renderTasksView({
    items: [
      {
        id: 't1',
        title: 'Call',
        status: 'open',
        due_at: '2000-01-01T00:00:00Z',
        overdue: true,
        case_id: 'c1',
      },
    ],
  });
  assert.match(tasks, /Überfällig/);
  assert.equal(countMutationControls(tasks), 0);

  for (const kind of [
    'loading',
    'empty',
    'error',
    'unauthorized',
    'session_expired',
    'malformed',
  ]) {
    assert.match(renderStateBlock(kind, 'x'), new RegExp(`data-state="${kind}"`));
  }
});

test('ops read client never executes write verbs', async () => {
  const calls = [];
  const client = createOpsReadClient({
    baseUrl: 'http://127.0.0.1:3099',
    getToken: () => 'tok',
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method });
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, items: [] };
        },
      };
    },
  });
  await client.listInbox();
  assert.equal(calls[0].method, 'GET');
  const post = await client.post('/ops/v1/writes/tasks');
  assert.equal(post.status, 405);
  assert.equal(client.getWriteAttempts().length, 1);
});

test('production CC UI rejected', () => {
  const srv = createLocalCcServer({
    env: { NODE_ENV: 'production', DTH_CC_LOCAL_UI_ENABLED: 'true' },
  });
  assert.equal(srv.ok, false);
  assert.throws(() => srv.listen(), /PRODUCTION_CC_UI_REJECTED/);
});

test('local CC server serves shell for three routes', async () => {
  const srv = createLocalCcServer({
    host: '127.0.0.1',
    port: 0,
    env: { NODE_ENV: 'test', DTH_CC_LOCAL_UI_ENABLED: 'true' },
  });
  await new Promise((resolve, reject) => {
    srv.server.listen(0, '127.0.0.1', resolve);
    srv.server.once('error', reject);
  });
  const { port } = srv.server.address();
  try {
    for (const path of ['/inbox', '/vorgaenge', '/aufgaben']) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /data-mutation-controls="0"/);
      assert.equal(countMutationControls(html), 0);
      assert.match(html, /Lokal \/ Dev/);
    }
    const post = await fetch(`http://127.0.0.1:${port}/inbox`, { method: 'POST' });
    assert.equal(post.status, 405);
  } finally {
    await srv.close();
  }
});
