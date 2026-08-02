import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpsBff, INTERNAL_BFF_PREFIX } from '../index.js';
import {
  createLocalOpsHttpReadAdapter,
  encodeLocalAuthToken,
} from './http-read-adapter.js';

function fakePool() {
  return {
    query: async (sql) => {
      if (/FROM public\.leads/i.test(sql)) {
        return {
          rows: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              lead_ref: 'L-T',
              lead_type: 'business_energy',
              page_source: 'unternehmen',
              source_page: '/unternehmen',
              status: 'new',
              email: 'synth@example.test',
              created_at: '2026-01-01T00:00:00.000Z',
              linked_case_id: null,
            },
          ],
        };
      }
      if (/FROM public\.career_applications/i.test(sql)) return { rows: [] };
      if (/FROM public\.cases/i.test(sql)) return { rows: [] };
      if (/FROM public\.tasks/i.test(sql)) return { rows: [] };
      return { rows: [] };
    },
    end: async () => {},
  };
}

async function withAdapter(env, fn) {
  const bff = createOpsBff({ pool: fakePool() });
  const adapter = createLocalOpsHttpReadAdapter({
    bff,
    host: '127.0.0.1',
    port: 0,
    env,
    corsOrigin: 'http://127.0.0.1:3100',
  });
  if (!adapter.ok) return fn(adapter, null);
  await new Promise((resolve, reject) => {
    adapter.server.listen(0, '127.0.0.1', resolve);
    adapter.server.once('error', reject);
  });
  const { port } = adapter.server.address();
  try {
    return await fn(adapter, port);
  } finally {
    await adapter.close();
    await bff.close();
  }
}

test('production HTTP adapter rejected', async () => {
  const adapter = createLocalOpsHttpReadAdapter({
    bff: createOpsBff({ pool: fakePool() }),
    env: { NODE_ENV: 'production', DTH_OPS_HTTP_ADAPTER_ENABLED: 'true' },
  });
  assert.equal(adapter.PRODUCTION_HTTP_ADAPTER, 'REJECTED');
  assert.throws(() => adapter.listen(), /PRODUCTION_HTTP_ADAPTER_REJECTED/);
});

test('non-GET rejected; writes not exposed; inbox GET works with local session', async () => {
  await withAdapter(
    {
      NODE_ENV: 'test',
      DTH_OPS_HTTP_ADAPTER_ENABLED: 'true',
      DTH_LOCAL_AUTH_ENABLED: 'true',
    },
    async (adapter, port) => {
      assert.equal(adapter.HTTP_WRITE_ROUTES_EXPOSED, 0);
      const base = `http://127.0.0.1:${port}`;

      const post = await fetch(`${base}${INTERNAL_BFF_PREFIX}/writes/tasks`, {
        method: 'POST',
        body: '{}',
      });
      assert.equal(post.status, 405);

      const sessionRes = await fetch(`${base}${INTERNAL_BFF_PREFIX}/dev/session`);
      assert.equal(sessionRes.status, 200);
      const sessionBody = await sessionRes.json();
      assert.equal(sessionBody.ok, true);

      const inbox = await fetch(`${base}${INTERNAL_BFF_PREFIX}/inbox`, {
        headers: { authorization: `DTH-Local ${sessionBody.token}` },
      });
      assert.equal(inbox.status, 200);
      const body = await inbox.json();
      assert.equal(body.ok, true);
      assert.ok(Array.isArray(body.items));

      const noAuth = await fetch(`${base}${INTERNAL_BFF_PREFIX}/inbox`);
      assert.equal(noAuth.status, 401);

      const shared = await fetch(`${base}${INTERNAL_BFF_PREFIX}/inbox`, {
        headers: {
          authorization: `DTH-Local ${sessionBody.token}`,
          'x-dth-shared-secret-context': 'true',
        },
      });
      assert.equal(shared.status, 401);

      // encode helper sanity
      const tok = encodeLocalAuthToken({
        principal: sessionBody.principal,
        session: sessionBody.session,
      });
      assert.equal(typeof tok, 'string');
    },
  );
});
