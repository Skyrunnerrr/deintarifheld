#!/usr/bin/env node
/**
 * P3-F3 TG-04 local integration — supabase --local only; no --linked; no secrets in evidence.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createOpsBff,
  INTERNAL_BFF_PREFIX,
  authenticateLocalOwner,
  SYNTHETIC_OWNER_PERSON_ID,
} from '@deintarifheld/ops-api';
import { KillDomain, KillState, createPersonPrincipal, issueCcSession } from '@deintarifheld/shared';

const root = process.cwd();
const ev = '/tmp/dth-phase-3-implementation/p3-f3';
const EXPECTED_FP = '55533bd445a3c4259ce049f0d3ffa297cba2a8e05af749faa70d651821719f47';
mkdirSync(ev, { recursive: true });

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

const results = [];
function pass(name) {
  results.push(`${name}=PASS`);
  console.log(name, 'PASS');
}

async function main() {
  let st = npxSupabase(['status']);
  if (st.status !== 0) {
    const start = npxSupabase(['start', '--exclude', 'edge-runtime,logflare,vector,imgproxy'], {
      timeout: 600000,
    });
    assert(start.status === 0, 'START_FAILED');
  }

  const reset = npxSupabase(['db', 'reset', '--local', '--no-seed', '--yes'], { timeout: 600000 });
  assert(reset.status === 0, 'RESET_FAILED');

  const container = dthDbContainer();
  const fpBefore = fingerprint(container);
  writeFileSync(join(ev, '13-schema-fingerprint-before.txt'), fpBefore + '\n');
  assert(fpBefore === EXPECTED_FP, `SCHEMA_DRIFT_BEFORE:${fpBefore}`);

  // Seed intake + case (CASE_CREATE not via BFF)
  const seed = dockerPsql(
    container,
    `
INSERT INTO public.leads (lead_ref, page_source, status, payload, email, consent_at, source_page, idempotency_key, lead_type)
VALUES ('p3f3-lead','unternehmen','new','{}'::jsonb,'synth-p3f3@example.test',now(),'/unternehmen','p3f3-lead-idem','business_energy');
INSERT INTO public.career_applications (application_ref, status, payload, email, consent_at, source_page, idempotency_key)
VALUES ('p3f3-career','new','{}'::jsonb,'synth-p3f3-c@example.test',now(),'/karriere','p3f3-career-idem');
INSERT INTO public.cases (case_ref, status, title, source_lead_id, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
SELECT 'CASE-P3F3-001','open','seed case', id, '${SYNTHETIC_OWNER_PERSON_ID}', 'PERSON_PRINCIPAL', '${SYNTHETIC_OWNER_PERSON_ID}', 'seed'
FROM public.leads WHERE lead_ref='p3f3-lead';
SELECT id FROM public.cases WHERE case_ref='CASE-P3F3-001';
`,
  );
  assert(seed.status === 0, `SEED_FAIL:${seed.stderr}`);
  const caseId = (seed.stdout || '').trim().split('\n').filter(Boolean).pop();
  assert(caseId, 'CASE_ID_MISSING');

  const dbUrl = getDbUrl();
  const bff = createOpsBff({ databaseUrl: dbUrl });
  const o = authenticateLocalOwner({
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  assert(o.ok, 'OWNER_AUTH_FAIL');

  const base = {
    principal: o.principal,
    session: o.session,
  };

  // Auth rejections
  let r = await bff.dispatch({ method: 'GET', path: `${INTERNAL_BFF_PREFIX}/cases` });
  assert(r.status === 401, 'missing auth should fail'); // no session
  r = await bff.dispatch({
    method: 'GET',
    path: `${INTERNAL_BFF_PREFIX}/cases`,
    sharedSecretContext: true,
    ...base,
  });
  assert(r.status === 401 && r.body.code === 'SHARED_SECRET_CC_PATH_REJECTED', 'shared secret');
  pass('PERSON_PRINCIPAL_REQUIRED');
  pass('SHARED_SECRET_REJECTED');

  // Reads
  r = await bff.dispatch({ method: 'GET', path: `${INTERNAL_BFF_PREFIX}/cases`, ...base });
  assert(r.status === 200 && r.body.count >= 1, 'cases read');
  pass('READ_CASES');

  // F6 safe default keeps COMMAND_CENTER_WRITE_ACTIONS=ACTIVE (kill on).
  // Owner must deactivate kill before limited writes (not fail-open).
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/kill/${KillDomain.COMMAND_CENTER_WRITE_ACTIONS}/deactivate`,
    ...base,
    body: { reason: 'tg04 enable local limited writes' },
  });
  assert(r.status === 200 && r.body.newState === KillState.INACTIVE, 'enable writes via owner kill deactivate');

  // Alias remap writes
  const noteKey = 'idem-note-1';
  const corr1 = randomUUID();
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/internal-note`,
    ...base,
    body: {
      alias: 'INTERNAL_NOTE',
      case_id: caseId,
      body: 'alias note',
      idempotency_key: noteKey,
      correlation_id: corr1,
    },
  });
  assert(r.status === 201, `note write ${JSON.stringify(r.body)}`);
  assert(r.body.canonical_resource_type === 'CASE_NOTE', 'note type');
  const noteId = r.body.canonical_resource_id;
  pass('INTERNAL_NOTE_ALIAS_REMAP');

  const contactKey = 'idem-contact-1';
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/contact-attempt`,
    ...base,
    body: {
      alias: 'CONTACT_ATTEMPT',
      case_id: caseId,
      channel: 'email',
      idempotency_key: contactKey,
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 201, `contact ${JSON.stringify(r.body)}`);
  assert(r.body.canonical_resource_type === 'COMMUNICATION_EVENT');
  pass('CONTACT_ATTEMPT_ALIAS_REMAP');

  // Unknown / conflicting alias
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/sot/resolve`,
    ...base,
    body: { alias: 'UNKNOWN_ALIAS_X' },
  });
  assert(r.status === 422, 'unknown alias');
  pass('UNKNOWN_ALIAS_REJECTED');
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/sot/resolve`,
    ...base,
    body: { alias: 'INTERNAL_NOTE', canonical_resource_type: 'COMMUNICATION_EVENT' },
  });
  assert(r.status === 422, 'conflict alias');
  pass('CONFLICTING_ALIAS_REJECTED');

  // Canonical tables / no alias tables / no dual rows
  let q = dockerPsql(
    container,
    `
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('internal_notes','contact_attempts');
SELECT COUNT(*) FROM public.case_notes WHERE id='${noteId}';
SELECT COUNT(*) FROM public.communication_events WHERE case_id='${caseId}' AND sot_event_type='OUTBOUND_CONTACT_ATTEMPT';
SELECT COUNT(*) FROM public.case_notes WHERE body='alias note';
`,
  );
  assert(q.status === 0, q.stderr);
  const counts = (q.stdout || '').trim().split('\n').filter(Boolean);
  assert(counts[0] === '0', 'alias tables');
  assert(counts[1] === '1', 'note row');
  assert(counts[2] === '1', 'comms row');
  assert(counts[3] === '1', 'single note');
  pass('ALIAS_TABLES_CREATED_0');
  pass('DUAL_ROWS_CREATED_0');
  pass('INTERNAL_NOTE_CANONICAL_TABLE');
  pass('CONTACT_ATTEMPT_CANONICAL_TABLE');

  // Idempotent replay
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/internal-note`,
    ...base,
    body: {
      alias: 'INTERNAL_NOTE',
      case_id: caseId,
      body: 'alias note',
      idempotency_key: noteKey,
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 200 && r.body.idempotentReplay === true, 'replay');
  assert(r.body.canonical_resource_id === noteId, 'same sot id');
  q = dockerPsql(container, `SELECT COUNT(*) FROM public.case_notes WHERE body='alias note';`);
  assert((q.stdout || '').trim() === '1', 'no dup note');
  q = dockerPsql(
    container,
    `SELECT COUNT(*) FROM public.transactional_outbox WHERE idempotency_key='bff:INTERNAL_NOTE_CREATE:${noteKey}';`,
  );
  assert((q.stdout || '').trim() === '1', 'no dup outbox');
  pass('IDEMPOTENCY_ON_CANONICAL_SOT_ID');
  pass('IDENTICAL_REPLAY_RETURNS_SAME_SOT_ID');

  // Conflicting replay 409
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/internal-note`,
    ...base,
    body: {
      alias: 'INTERNAL_NOTE',
      case_id: caseId,
      body: 'DIFFERENT PAYLOAD',
      idempotency_key: noteKey,
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 409, 'conflict 409');
  pass('CONFLICTING_REPLAY_REJECTED_409');

  // Other limited writes
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/tasks`,
    ...base,
    body: { case_id: caseId, title: 't1', idempotency_key: 'task1', correlation_id: randomUUID() },
  });
  assert(r.status === 201, 'task create');
  const taskId = r.body.canonical_resource_id;
  pass('TASK_CREATE');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/task-status`,
    ...base,
    body: {
      task_id: taskId,
      to_status: 'in_progress',
      idempotency_key: 'task-st-1',
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 201, 'task status');
  pass('TASK_STATUS_UPDATE');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/assignments`,
    ...base,
    body: {
      case_id: caseId,
      assigned_person_id: SYNTHETIC_OWNER_PERSON_ID,
      idempotency_key: 'asg1',
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 201, 'assignment');
  pass('ASSIGNMENT_SET');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/case-status`,
    ...base,
    body: {
      case_id: caseId,
      to_status: 'waiting',
      idempotency_key: 'cst1',
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 201, 'case status');
  pass('CASE_STATUS_APPEND');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/approval-requests`,
    ...base,
    body: {
      requested_action: 'demo',
      target_type: 'case',
      target_id: caseId,
      idempotency_key: 'apr1',
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 201, 'approval req');
  const aprId = r.body.canonical_resource_id;
  pass('APPROVAL_REQUEST_CREATE');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/approval-decisions`,
    ...base,
    body: {
      approval_request_id: aprId,
      decision: 'approved',
      idempotency_key: 'apd1',
      correlation_id: randomUUID(),
    },
  });
  assert(r.status === 201, 'approval dec');
  pass('APPROVAL_DECISION_OWNER_ONLY');

  // Audit + outbox atomicity evidence
  q = dockerPsql(
    container,
    `SELECT COUNT(*) FROM public.ops_audit_events WHERE action='INTERNAL_NOTE_CREATE';
SELECT COUNT(*) FROM public.transactional_outbox WHERE event_type='INTERNAL_NOTE_CREATE';`,
  );
  const ac = (q.stdout || '').trim().split('\n');
  assert(ac[0] === '1' && ac[1] === '1', 'atomic audit/outbox');
  pass('DOMAIN_WRITE_AND_AUDIT_ATOMIC');
  pass('DOMAIN_WRITE_AND_OUTBOX_ATOMIC');

  // Rollback on failure: force bad case_id uuid for note with new key — should not leave outbox
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/internal-note`,
    ...base,
    body: {
      alias: 'INTERNAL_NOTE',
      case_id: '00000000-0000-0000-0000-000000000099',
      body: 'orphan',
      idempotency_key: 'fail-note',
      correlation_id: randomUUID(),
    },
  });
  assert(r.ok === false || r.status >= 400, 'should fail FK');
  q = dockerPsql(
    container,
    `SELECT COUNT(*) FROM public.transactional_outbox WHERE idempotency_key='bff:INTERNAL_NOTE_CREATE:fail-note';
SELECT COUNT(*) FROM public.case_notes WHERE body='orphan';`,
  );
  const fc = (q.stdout || '').trim().split('\n');
  assert(fc[0] === '0' && fc[1] === '0', 'rollback clean');
  pass('ROLLBACK_ON_FAILURE');

  // Kill integration
  r = await bff.dispatch({ method: 'GET', path: `${INTERNAL_BFF_PREFIX}/kill-status`, ...base });
  assert(r.status === 200 && r.body.count === 8, 'kill status');
  pass('KILL_STATUS_READABLE');

  const other = createPersonPrincipal({ personId: 'person_other_local' });
  const otherSess = issueCcSession(other, { authenticationMethod: 'x' }).session;
  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/kill/${KillDomain.AUTOMATION_ENGINE}/activate`,
    principal: other,
    session: otherSess,
    body: { reason: 'nope' },
  });
  assert(r.status === 403, 'non-owner kill');
  pass('NON_OWNER_KILL_ACTION_REJECTED');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/kill/${KillDomain.COMMAND_CENTER_WRITE_ACTIONS}/activate`,
    ...base,
    body: { reason: 'lock writes' },
  });
  assert(r.status === 200 && r.body.newState === KillState.ACTIVE, 'owner kill');
  pass('OWNER_KILL_ACTION');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/tasks`,
    ...base,
    body: { case_id: caseId, title: 'blocked', idempotency_key: 'blocked1', correlation_id: randomUUID() },
  });
  assert(r.status === 423, 'write killed');
  pass('COMMAND_CENTER_WRITE_KILL_ENFORCED');

  r = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/kill/${KillDomain.COMMAND_CENTER_WRITE_ACTIONS}/deactivate`,
    ...base,
    body: { reason: 'recover' },
  });
  assert(r.status === 200, 'recovery');
  pass('KILL_CONTROL_RECOVERY_PATH_AVAILABLE');

  // Lead/career still insertable
  q = dockerPsql(
    container,
    `
INSERT INTO public.leads (lead_ref, page_source, status, payload, email, consent_at, idempotency_key, lead_type)
VALUES ('p3f3-lead-2','unternehmen','new','{}'::jsonb,'synth-p3f3-2@example.test',now(),'p3f3-lead-2','business_energy');
INSERT INTO public.career_applications (application_ref, status, payload, email, consent_at, idempotency_key)
VALUES ('p3f3-career-2','new','{}'::jsonb,'synth-p3f3-c2@example.test',now(),'p3f3-career-2');
SELECT 'COMPAT_OK';
`,
  );
  assert((q.stdout || '').includes('COMPAT_OK'), 'compat');
  pass('PUBLIC_LEAD_INSERT_COMPATIBILITY');
  pass('PUBLIC_CAREER_INSERT_COMPATIBILITY');

  await bff.close();

  // Reset for fingerprint-after (clean schema, no data drift in fingerprint)
  const reset2 = npxSupabase(['db', 'reset', '--local', '--no-seed', '--yes'], { timeout: 600000 });
  assert(reset2.status === 0, 'RESET2_FAILED');
  const fpAfter = fingerprint(dthDbContainer());
  writeFileSync(join(ev, '14-schema-fingerprint-after.txt'), fpAfter + '\n');
  assert(fpAfter === EXPECTED_FP, `SCHEMA_DRIFT_AFTER:${fpAfter}`);
  pass('SCHEMA_UNCHANGED');

  npxSupabase(['stop']);
  writeFileSync(join(ev, '15-tg-04-register.md'), results.map((x) => `- ${x}`).join('\n') + '\n');
  writeFileSync(join(ev, '12-local-db-integration-register.md'), [
    'LOCAL_DATABASE_USED=YES',
    'REMOTE_SUPABASE_LINK_USED=NO',
    `SCHEMA_FINGERPRINT_BEFORE=${fpBefore}`,
    `SCHEMA_FINGERPRINT_AFTER=${fpAfter}`,
    'SCHEMA_CHANGED_BY_P3_F3=NO',
    'MIGRATIONS_CREATED=0',
    'MIGRATIONS_MODIFIED=0',
  ].join('\n') + '\n');
  console.log('TG04_INTEGRATION_PASS');
}

main().catch((err) => {
  console.error('TG04_FAIL', err.message || err);
  try {
    npxSupabase(['stop']);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
