#!/usr/bin/env node
/**
 * P3-F2b local replay helper — supabase CLI --local only + docker exec into DTH db container.
 * Never uses --linked. Never prints DB URLs/secrets. Never touches non-DTH containers.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const ev = '/tmp/dth-phase-3-implementation/p3-f2b';
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
  if (!m) throw new Error('PROJECT_ID_NOT_FOUND_IN_CONFIG');
  const name = `supabase_db_${m[1]}`;
  const ps = run('docker', ['ps', '--format', '{{.Names}}']);
  if (ps.status !== 0 || !(ps.stdout || '').split('\n').includes(name)) {
    throw new Error(`DTH_DB_CONTAINER_NOT_RUNNING`);
  }
  // Hard deny Averion containers
  if (/averion/i.test(name)) throw new Error('AVERION_CONTAINER_REFUSED');
  return name;
}

function dockerPsql(container, args) {
  return run('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', ...args]);
}

function dockerPsqlFile(container, file) {
  const sql = readFileSync(file);
  return spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    cwd: root,
    encoding: 'utf8',
    input: sql,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function fingerprint(container, outPath) {
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
  const res = dockerPsql(container, ['-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql]);
  if (res.status !== 0) throw new Error(`FINGERPRINT_FAILED:${res.stderr || res.stdout}`);
  const body = (res.stdout || '').trim() + '\n';
  writeFileSync(outPath, body);
  const hash = createHash('sha256').update(body).digest('hex');
  writeFileSync(outPath + '.sha256', `${hash}\n`);
  return hash;
}

function securityChecks(container) {
  const sql = `
SELECT 'kill_state=' || COUNT(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%kill_state%';
SELECT 'commission=' || COUNT(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%commission%';
SELECT 'partner_pay=' || COUNT(*)::text FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%partner_pay%' OR table_name ILIKE '%partner_payout%');
SELECT 'teleson=' || COUNT(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%teleson%';
SELECT 'averion_schema=' || COUNT(*)::text FROM information_schema.schemata WHERE schema_name ILIKE '%averion%';
SELECT 'permissive_policies=' || COUNT(*)::text FROM pg_policies WHERE schemaname='public' AND (COALESCE(qual,'') ILIKE '%true%' OR COALESCE(with_check,'') ILIKE '%true%');
SELECT 'public_grants_new=' || COUNT(*)::text FROM information_schema.role_table_grants
  WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')
    AND table_name IN ('cases','case_notes','tasks','task_reminders','case_assignments','status_history','communication_events','ops_audit_events','approval_requests','approval_decisions','transactional_outbox')
    AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE');
`;
  const res = dockerPsql(container, ['-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql]);
  if (res.status !== 0) throw new Error(`SECURITY_FAILED:${res.stderr || res.stdout}`);
  return (res.stdout || '').trim();
}

const runId = process.argv[2] || '1';
console.log(`P3_F2B_REPLAY_RUN=${runId}`);

let st = npxSupabase(['status']);
if (st.status !== 0) {
  console.log('STARTING_LOCAL_SUPABASE');
  const start = npxSupabase(['start', '--exclude', 'edge-runtime,logflare,vector,imgproxy'], { timeout: 600000 });
  if (start.status !== 0) {
    console.error('START_FAILED');
    process.exit(2);
  }
}

console.log('DB_RESET_LOCAL');
const reset = npxSupabase(['db', 'reset', '--local', '--no-seed', '--yes'], { timeout: 600000 });
writeFileSync(join(ev, `replay-run-${runId}-reset.exit.txt`), `EXIT=${reset.status}\n`);
if (reset.status !== 0) {
  // redact-ish: keep only last lines without env dumps if any
  writeFileSync(join(ev, `replay-run-${runId}-reset.err.txt`), String(reset.stderr || reset.stdout || '').slice(-4000));
  console.error('RESET_FAILED');
  process.exit(3);
}

const container = dthDbContainer();
console.log(`DTH_DB_CONTAINER_OK`);

const tg = dockerPsqlFile(container, join(root, 'packages/db/tests/p3-f2b-tg03-validation.sql'));
writeFileSync(join(ev, `replay-run-${runId}-tg03.out.txt`), (tg.stdout || '') + '\nSTDERR_LEN=' + String((tg.stderr || '').length));
if (tg.status !== 0 || !(tg.stdout || '').includes('TG03_SQL_PASS')) {
  console.error('TG03_FAILED');
  writeFileSync(join(ev, `replay-run-${runId}-tg03.err.txt`), String(tg.stderr || '').slice(-4000));
  process.exit(4);
}

const fpOut = runId === '1'
  ? join(ev, '11-schema-fingerprint-run-1.txt')
  : join(ev, '12-schema-fingerprint-run-2.txt');
const hash = fingerprint(container, fpOut);
console.log(`SCHEMA_FINGERPRINT_RUN_${runId}=${hash}`);

const sec = securityChecks(container);
writeFileSync(join(ev, `replay-run-${runId}-security.txt`), sec + '\n');
for (const line of sec.split('\n')) {
  const [k, v] = line.split('=');
  if (v && v !== '0' && k !== undefined) {
    // permissive_policies / public_grants_new / forbidden counts must be 0
    console.error('SECURITY_NONZERO', line);
    process.exit(6);
  }
}

if (runId === '2') {
  const rb = dockerPsqlFile(container, join(root, 'packages/db/tests/p3-f2b-rollback-reference.sql'));
  writeFileSync(join(ev, '19-rollback-validation-raw.txt'), (rb.stdout || '') + '\nSTDERR_LEN=' + String((rb.stderr || '').length));
  if (rb.status !== 0 || !(rb.stdout || '').includes('ROLLBACK_REFERENCE_PASS')) {
    console.error('ROLLBACK_FAILED');
    process.exit(5);
  }
  console.log('ROLLBACK_REFERENCE_PASS');
}

writeFileSync(
  join(ev, runId === '1' ? '09-fresh-replay-run-1.txt' : '10-fresh-replay-run-2.txt'),
  [
    `FRESH_REPLAY_RUN_${runId}=PASS`,
    'MIGRATIONS_APPLIED=001..013 via supabase db reset --local',
    'TG03=PASS',
    `SCHEMA_FINGERPRINT=${hash}`,
    'REMOTE_LINKED_FLAG_USED=NO',
    'COMMAND=npx supabase db reset --local --no-seed --yes',
    'DB_ACCESS=docker exec DTH supabase_db container only',
    'AVERION_CONTAINERS_TOUCHED=NO',
  ].join('\n') + '\n',
);

console.log(`FRESH_REPLAY_RUN_${runId}=PASS`);
process.exit(0);
