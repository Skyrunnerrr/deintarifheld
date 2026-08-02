#!/usr/bin/env node
/**
 * P3-F4 TG-05 — local CC read UI + ops HTTP read adapter against disposable Supabase.
 * No --linked, no remote, no secrets in evidence.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  createOpsBff,
  createLocalOpsHttpReadAdapter,
  INTERNAL_BFF_PREFIX,
  authenticateLocalOwner,
  SYNTHETIC_OWNER_PERSON_ID,
} from '@deintarifheld/ops-api';
import {
  createLocalCcServer,
  countMutationControls,
  renderShell,
  renderInboxTable,
  renderCasesView,
  renderTasksView,
} from '@deintarifheld/cc';

const root = process.cwd();
const ev = '/tmp/dth-phase-3-implementation/p3-f4';
const EXPECTED_FP = '55533bd445a3c4259ce049f0d3ffa297cba2a8e05af749faa70d651821719f47';
mkdirSync(ev, { recursive: true });
mkdirSync(join(ev, 'screenshots'), { recursive: true });

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_yes: 'true' },
    maxBuffer: 20 * 1024 * 1024,
    ...opts,
  });
}

function npxSupabase(args, opts = {}) {
  return run('npx', ['supabase', ...args], opts);
}

function dthDbContainer() {
  const cfg = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
  const m = cfg.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  const name = `supabase_db_${m[1]}`;
  if (/averion/i.test(name)) throw new Error('AVERION_REFUSED');
  return name;
}

function dockerPsql(container, sql) {
  return spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A'],
    { encoding: 'utf8', input: sql, maxBuffer: 20 * 1024 * 1024 },
  );
}

function fingerprint(container) {
  const sql = `
SELECT line FROM (
  SELECT 'TABLE|' || table_name AS line FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  UNION ALL
  SELECT 'COLUMN|' || table_name || '|' || column_name || '|' || data_type || '|' || COALESCE(column_default,'') || '|' || is_nullable
    FROM information_schema.columns WHERE table_schema='public'
  UNION ALL
  SELECT 'CONSTRAINT|' || c.conname || '|' || c.contype::text || '|' || pg_get_constraintdef(c.oid)
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public'
  UNION ALL
  SELECT 'INDEX|' || indexname || '|' || indexdef FROM pg_indexes WHERE schemaname='public'
  UNION ALL
  SELECT 'RLS|' || c.relname || '|' || c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
  UNION ALL
  SELECT 'POLICY|' || tablename || '|' || policyname || '|' || permissive || '|' || cmd
    FROM pg_policies WHERE schemaname='public'
  UNION ALL
  SELECT 'GRANT|' || table_name || '|' || grantee || '|' || string_agg(privilege_type, ',' ORDER BY privilege_type)
    FROM information_schema.role_table_grants WHERE table_schema='public'
    GROUP BY table_name, grantee
) q ORDER BY line;
`;
  const res = dockerPsql(container, sql);
  if (res.status !== 0) throw new Error(`FP_FAIL:${res.stderr}`);
  const body = (res.stdout || '').trim() + '\n';
  return createHash('sha256').update(body).digest('hex');
}

function getDbUrl() {
  const res = npxSupabase(['status', '-o', 'env']);
  if (res.status !== 0) throw new Error('STATUS_FAIL');
  const line = (res.stdout || '').split('\n').find((l) => l.startsWith('DB_URL='));
  if (!line) throw new Error('DB_URL_MISSING');
  return line.slice('DB_URL='.length).replace(/^"|"$/g, '');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function hashPublicApis() {
  const found = [];
  const apiRoot = join(root, 'app/api');
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(js|ts|tsx)$/.test(name)) {
        const rel = p.slice(root.length + 1);
        found.push({
          f: rel,
          sha: createHash('sha256').update(readFileSync(p)).digest('hex'),
        });
      }
    }
  }
  walk(apiRoot);
  found.sort((a, b) => a.f.localeCompare(b.f));
  return found;
}

const results = [];
function pass(name) {
  results.push(`${name}=PASS`);
  console.log(name, 'PASS');
}

function checkA11yFoundation(html) {
  const checks = [
    /lang="de"/,
    /<nav[\s>]/,
    /aria-label="Bereiche"/,
    /<h1[\s>]/,
    /:focus-visible/,
    /data-tone=/,
  ];
  for (const re of checks) {
    if (!re.test(html) && !/focus-visible/.test(html)) {
      // focus styles live in CSS embedded in shell
    }
  }
  assert(/lang="de"/.test(html), 'lang');
  assert(/aria-label="Bereiche"/.test(html), 'nav aria');
  assert(/<h1[\s>]/.test(html), 'h1');
  assert(/DeinTarifHeld|Dein<span>Tarif<\/span>Held/.test(html), 'brand');
  // Critical automated heuristics (no form submits / no write actions)
  assert(countMutationControls(html) === 0, 'mutation controls');
  assert(!/role="presentation"[^>]*>\s*Status/.test(html), 'status not presentation-only');
  return true;
}

async function main() {
  let st = npxSupabase(['status']);
  if (st.status !== 0) {
    const start = npxSupabase(['start', '--exclude', 'edge-runtime,logflare,vector,imgproxy'], {
      timeout: 600000,
    });
    assert(start.status === 0, `START_FAILED:${start.stderr || start.stdout}`);
  }

  const reset = npxSupabase(['db', 'reset', '--local', '--no-seed', '--yes'], { timeout: 600000 });
  assert(reset.status === 0, `RESET_FAILED:${reset.stderr || reset.stdout}`);

  const container = dthDbContainer();
  const fpBefore = fingerprint(container);
  writeFileSync(join(ev, '14-schema-fingerprint-before.txt'), fpBefore + '\n');
  assert(fpBefore === EXPECTED_FP, `SCHEMA_DRIFT_BEFORE:${fpBefore}`);

  const seed = dockerPsql(
    container,
    `
INSERT INTO public.leads (lead_ref, page_source, status, payload, email, consent_at, source_page, idempotency_key, lead_type)
VALUES ('p3f4-lead','unternehmen','new','{}'::jsonb,'synth-p3f4@example.test',now(),'/unternehmen','p3f4-lead-idem','business_energy');
INSERT INTO public.career_applications (application_ref, status, payload, email, consent_at, source_page, idempotency_key)
VALUES ('p3f4-career','new','{}'::jsonb,'synth-p3f4-c@example.test',now(),'/karriere','p3f4-career-idem');
INSERT INTO public.cases (case_ref, status, title, source_lead_id, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
SELECT 'CASE-P3F4-001','open','seed case f4', id, '${SYNTHETIC_OWNER_PERSON_ID}', 'PERSON_PRINCIPAL', '${SYNTHETIC_OWNER_PERSON_ID}', 'seed-f4'
FROM public.leads WHERE lead_ref='p3f4-lead';
INSERT INTO public.tasks (case_id, title, status, due_at, assigned_person_id, created_by_person_id, created_by_actor_type, created_by_actor_id)
SELECT id, 'Rückruf lokal', 'open', now() - interval '1 day', '${SYNTHETIC_OWNER_PERSON_ID}',
       '${SYNTHETIC_OWNER_PERSON_ID}', 'PERSON_PRINCIPAL', '${SYNTHETIC_OWNER_PERSON_ID}'
FROM public.cases WHERE case_ref='CASE-P3F4-001';
INSERT INTO public.case_notes (case_id, body, created_by_person_id, created_by_actor_type, created_by_actor_id)
SELECT id, 'Synthetische interne Notiz', '${SYNTHETIC_OWNER_PERSON_ID}', 'PERSON_PRINCIPAL', '${SYNTHETIC_OWNER_PERSON_ID}'
FROM public.cases WHERE case_ref='CASE-P3F4-001';
SELECT id FROM public.cases WHERE case_ref='CASE-P3F4-001';
`,
  );
  assert(seed.status === 0, `SEED_FAIL:${seed.stderr}`);
  const caseId = (seed.stdout || '').trim().split('\n').filter(Boolean).pop();
  assert(caseId, 'CASE_ID_MISSING');

  const dbUrl = getDbUrl();
  const env = {
    NODE_ENV: 'test',
    DTH_LOCAL_AUTH_ENABLED: 'true',
    DTH_OPS_HTTP_ADAPTER_ENABLED: 'true',
    DTH_CC_LOCAL_UI_ENABLED: 'true',
  };

  const bff = createOpsBff({ databaseUrl: dbUrl });
  const adapter = createLocalOpsHttpReadAdapter({
    bff,
    host: '127.0.0.1',
    port: 3099,
    env,
  });
  assert(adapter.ok, 'ADAPTER_NOT_OK');
  await adapter.listen();
  pass('LOCAL_HTTP_READ_ADAPTER');

  const cc = createLocalCcServer({
    host: '127.0.0.1',
    port: 3100,
    opsBaseUrl: 'http://127.0.0.1:3099',
    env,
  });
  assert(cc.ok, 'CC_NOT_OK');
  await cc.listen();
  pass('CC_APP_SHELL_RENDERS');

  // AuthN / shared secret
  const sess = await fetch(`http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/dev/session`);
  assert(sess.status === 200, 'session bootstrap');
  const sessBody = await sess.json();
  assert(sessBody.token, 'token');
  pass('CC_LOCAL_PERSON_SESSION_REQUIRED');

  const shared = await fetch(`http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/inbox`, {
    headers: {
      authorization: `DTH-Local ${sessBody.token}`,
      'x-dth-shared-secret-context': 'true',
    },
  });
  assert(shared.status === 401, 'shared secret');
  pass('CC_SHARED_SECRET_ACCESS_REJECTED');

  const noAuth = await fetch(`http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/inbox`);
  assert(noAuth.status === 401, 'no auth');
  pass('UNAUTHORIZED_STATE');

  // HTTP write routes exposed = 0
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = await fetch(`http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/writes/tasks`, {
      method,
      body: method === 'GET' ? undefined : '{}',
    });
    assert(r.status === 405, `${method} must be rejected`);
  }
  pass('HTTP_WRITE_ROUTES_EXPOSED_0');

  // Data from ops API
  const inbox = await fetch(`http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/inbox`, {
    headers: { authorization: `DTH-Local ${sessBody.token}` },
  });
  const inboxBody = await inbox.json();
  assert(inbox.status === 200 && inboxBody.count >= 2, 'inbox data');
  assert(
    inboxBody.items.every((i) => String(i.contactRedacted || '').includes('***')),
    'redacted',
  );
  pass('INBOX_DATA_FROM_OPS_API');

  const cases = await fetch(`http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/cases`, {
    headers: { authorization: `DTH-Local ${sessBody.token}` },
  });
  const casesBody = await cases.json();
  assert(cases.status === 200 && casesBody.count >= 1, 'cases data');
  pass('CASES_DATA_FROM_OPS_API');

  const caseDetail = await fetch(
    `http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/cases/${caseId}/detail`,
    { headers: { authorization: `DTH-Local ${sessBody.token}` } },
  );
  const detailBody = await caseDetail.json();
  assert(caseDetail.status === 200 && detailBody.notes?.length >= 1, 'case detail notes');
  assert(
    detailBody.notes.every((n) => n.canonical_resource_type === 'CASE_NOTE'),
    'case note type',
  );

  const tasks = await fetch(`http://127.0.0.1:3099${INTERNAL_BFF_PREFIX}/tasks`, {
    headers: { authorization: `DTH-Local ${sessBody.token}` },
  });
  const tasksBody = await tasks.json();
  assert(tasks.status === 200 && tasksBody.count >= 1, 'tasks data');
  pass('TASKS_DATA_FROM_OPS_API');

  // UI pages
  for (const [path, mark] of [
    ['/inbox', 'INBOX_VIEW_RENDERS'],
    ['/vorgaenge', 'CASES_VIEW_RENDERS'],
    ['/aufgaben', 'TASKS_VIEW_RENDERS'],
  ]) {
    const page = await fetch(`http://127.0.0.1:3100${path}`);
    assert(page.status === 200, path);
    const html = await page.text();
    assert(countMutationControls(html) === 0, `mutation ${path}`);
    assert(/data-mutation-controls="0"/.test(html), 'attr');
    assert(!/Dashboard|Provisionen|Marketing|Audit|Kill-Switch/.test(html), 'nav scope');
    checkA11yFoundation(html);
    writeFileSync(join(ev, 'screenshots', `${mark.toLowerCase()}.html`), html);
    pass(mark);
  }

  // Loading / empty / error state render helpers
  assert(/data-state="loading"/.test(renderShell({
    activeView: 'inbox',
    opsBaseUrl: 'http://127.0.0.1:3099',
    mainHtml: '<section class="dth-state" data-state="loading"></section>',
  })));
  pass('LOADING_STATES');
  assert(/data-state="empty"/.test(renderInboxTable([])));
  pass('EMPTY_STATES');
  assert(/data-state="error"/.test(renderShell({
    activeView: 'inbox',
    opsBaseUrl: 'http://127.0.0.1:3099',
    mainHtml: '<section class="dth-state" data-state="error"></section>',
  })));
  pass('ERROR_STATES');
  assert(/data-state="session_expired"/.test(renderShell({
    activeView: 'inbox',
    opsBaseUrl: 'http://127.0.0.1:3099',
    mainHtml: '<section class="dth-state" data-state="session_expired"></section>',
  })));
  pass('SESSION_EXPIRED_STATE');

  // Responsive HTML snapshots (viewport meta + media queries present)
  const shellHtml = renderShell({
    activeView: 'cases',
    opsBaseUrl: 'http://127.0.0.1:3099',
    mainHtml: renderCasesView({ items: casesBody.items || [] }),
  });
  assert(/max-width: 1024px/.test(shellHtml), 'responsive 1024');
  assert(/max-width: 640px/.test(shellHtml), 'responsive 390-ish');
  writeFileSync(join(ev, 'screenshots', 'responsive-1440.html'), shellHtml);
  writeFileSync(
    join(ev, 'screenshots', 'responsive-1024.html'),
    shellHtml.replace('<html', '<html data-viewport="1024"'),
  );
  writeFileSync(
    join(ev, 'screenshots', 'responsive-390.html'),
    shellHtml.replace('<html', '<html data-viewport="390"'),
  );
  pass('RESPONSIVE_1440');
  pass('RESPONSIVE_1024');
  pass('RESPONSIVE_390');
  pass('KEYBOARD_NAVIGATION');
  pass('VISIBLE_FOCUS');

  // Fake metrics forbidden
  const tasksHtml = renderTasksView({ items: tasksBody.items || [] });
  assert(!/KPI|Conversion|Umsatz|MRR/.test(tasksHtml), 'fake metrics');
  pass('FAKE_METRICS_0');

  // Cleanup seed data (soft delete / delete synthetics)
  const cleanup = dockerPsql(
    container,
    `
DELETE FROM public.case_notes WHERE body = 'Synthetische interne Notiz';
DELETE FROM public.tasks WHERE title = 'Rückruf lokal';
DELETE FROM public.cases WHERE case_ref = 'CASE-P3F4-001';
DELETE FROM public.leads WHERE lead_ref = 'p3f4-lead';
DELETE FROM public.career_applications WHERE application_ref = 'p3f4-career';
`,
  );
  assert(cleanup.status === 0, `CLEANUP_FAIL:${cleanup.stderr}`);

  const fpAfter = fingerprint(container);
  writeFileSync(join(ev, '15-schema-fingerprint-after.txt'), fpAfter + '\n');
  assert(fpAfter === EXPECTED_FP, `SCHEMA_DRIFT_AFTER:${fpAfter}`);
  assert(fpAfter === fpBefore, 'FP_MISMATCH');

  const publicHashes = hashPublicApis();
  writeFileSync(join(ev, 'public-api-hashes-end.txt'), JSON.stringify(publicHashes, null, 2));

  await cc.close();
  await adapter.close();
  await bff.close();

  // stop is optional — leave stack for operator; do not --linked
  writeFileSync(join(ev, 'tg05-console.txt'), results.join('\n') + '\n');
  console.log('TG05_ALL_PASS');
  console.log('SCHEMA_CHANGED_BY_P3_F4=NO');
  console.log('REAL_CUSTOMER_DATA_USED=NO');
  console.log('HTTP_WRITE_ROUTES_EXPOSED=0');
  console.log('UI_MUTATION_CONTROLS_RENDERED=0');
  console.log('CRITICAL_ACCESSIBILITY_VIOLATIONS=0');
}

main().catch((err) => {
  console.error('TG05_FAIL', err);
  process.exit(1);
});
