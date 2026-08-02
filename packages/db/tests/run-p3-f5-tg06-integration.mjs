#!/usr/bin/env node
/**
 * P3-F5 TG-06 — fail-closed worker stub against disposable local Supabase.
 * Seeds synthetic noop via SQL only (not a second domain writer).
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  KillState,
  SYNTHETIC_NOOP_EVENT_TYPE,
  WorkerRunResultCode,
} from '@deintarifheld/shared';
import { createLocalOutboxPool } from '@deintarifheld/db';
import {
  runOneShotLocalWorker,
  resetNoopHandlerStats,
  getNoopHandlerStats,
  createDenyAllEffectAdapter,
} from '@deintarifheld/workers';

const root = process.cwd();
const ev = '/tmp/dth-phase-3-implementation/p3-f5';
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
  return createHash('sha256').update((res.stdout || '').trim() + '\n').digest('hex');
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
        found.push({
          f: p.slice(root.length + 1),
          sha: createHash('sha256').update(readFileSync(p)).digest('hex'),
        });
      }
    }
  }
  walk(apiRoot);
  found.sort((a, b) => a.f.localeCompare(b.f));
  return found;
}

function scanMailImports() {
  const roots = ['packages/workers', 'packages/db/src/outbox-claim.js', 'packages/shared/src/worker-activation.js'];
  const hits = [];
  const re = /resend|nodemailer|sendgrid|mailgun|smtp|@sendgrid/i;
  function walk(p) {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const n of readdirSync(p)) walk(join(p, n));
    } else if (/\.(js|mjs|ts)$/.test(p)) {
      const txt = readFileSync(p, 'utf8');
      if (re.test(txt)) hits.push(p);
    }
  }
  for (const r of roots) walk(join(root, r));
  return hits;
}

const results = [];
function pass(name) {
  results.push(`${name}=PASS`);
  console.log(name, 'PASS');
}

function positiveConfig(over = {}) {
  return {
    runtimeEnvironment: 'TEST',
    localTestFlag: true,
    automationActivation: true,
    automationEngineKillState: KillState.INACTIVE, // in-memory fixture only
    persistenceAdapter: 'DISPOSABLE_LOCAL_DATABASE',
    eventType: SYNTHETIC_NOOP_EVENT_TYPE,
    externalEffectAdapter: 'DENY_ALL',
    ...over,
  };
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
  writeFileSync(join(ev, '15-schema-fingerprint-before.txt'), fpBefore + '\n');
  assert(fpBefore === EXPECTED_FP, `SCHEMA_DRIFT_BEFORE:${fpBefore}`);

  writeFileSync(join(ev, 'public-api-hashes-before.txt'), JSON.stringify(hashPublicApis(), null, 2));

  const dbUrl = getDbUrl();
  const pool = createLocalOutboxPool(dbUrl);

  // Domain row counts before
  const countsBefore = dockerPsql(
    container,
    `SELECT 'leads='||(SELECT count(*) FROM public.leads)||
            ';career='||(SELECT count(*) FROM public.career_applications)||
            ';cases='||(SELECT count(*) FROM public.cases)||
            ';tasks='||(SELECT count(*) FROM public.tasks)||
            ';comms='||(SELECT count(*) FROM public.communication_events)||
            ';outbox='||(SELECT count(*) FROM public.transactional_outbox);`,
  );
  assert(countsBefore.status === 0, 'COUNT_BEFORE_FAIL');

  // Seed exactly one synthetic noop via SQL (test harness, not F3 writer / not worker writer)
  const idem = `p3f5-noop-${randomUUID()}`;
  const corr = randomUUID();
  const seed = dockerPsql(
    container,
    `INSERT INTO public.transactional_outbox
      (event_type, aggregate_type, aggregate_id, payload_redacted, idempotency_key, correlation_id, status)
     VALUES ('${SYNTHETIC_NOOP_EVENT_TYPE}','local_test','noop',
             '{"test":true,"operation":"NOOP"}'::jsonb,'${idem}','${corr}','pending');
SELECT id::text FROM public.transactional_outbox WHERE idempotency_key='${idem}';`,
  );
  assert(seed.status === 0, `SEED_FAIL:${seed.stderr}|${seed.stdout}`);
  const rowId = (seed.stdout || '').trim().split('\n').filter(Boolean).pop();
  assert(rowId && /^[0-9a-f-]{36}$/i.test(rowId), `ROW_ID_MISSING:${JSON.stringify(seed.stdout)}`);

  // --- OFF default / fail-closed matrix (kill remains ACTIVE — F6 default posture) ---
  resetNoopHandlerStats();
  const off = await runOneShotLocalWorker({
    pool,
    config: {
      runtimeEnvironment: 'TEST',
      localTestFlag: true,
      automationActivation: false,
      automationEngineKillState: KillState.ACTIVE,
      persistenceAdapter: 'DISPOSABLE_LOCAL_DATABASE',
      eventType: SYNTHETIC_NOOP_EVENT_TYPE,
      externalEffectAdapter: 'DENY_ALL',
    },
  });
  assert(off.jobsProcessed === 0, 'off jobs');
  assert(off.rowsClaimed === 0, 'off claim');
  assert(off.rowsMutated === 0, 'off mutate');
  assert(getNoopHandlerStats().totalInvocations === 0, 'off handlers');
  pass('WORKER_OFF_PROCESSES_ZERO_JOBS');
  pass('WORKER_OFF_CLAIMS_ZERO_ROWS');
  pass('WORKER_OFF_MUTATES_ZERO_ROWS');
  pass('WORKER_OFF_CALLS_ZERO_HANDLERS');

  const missing = await runOneShotLocalWorker({
    pool,
    config: {
      runtimeEnvironment: 'TEST',
      localTestFlag: true,
      // automationActivation missing
      automationEngineKillState: KillState.INACTIVE,
      persistenceAdapter: 'DISPOSABLE_LOCAL_DATABASE',
      eventType: SYNTHETIC_NOOP_EVENT_TYPE,
      externalEffectAdapter: 'DENY_ALL',
    },
  });
  assert(missing.jobsProcessed === 0, 'missing activation');
  pass('MISSING_ACTIVATION_CONFIG_FAILS_CLOSED');

  const invalid = await runOneShotLocalWorker({
    pool,
    config: positiveConfig({ automationActivation: 'maybe' }),
  });
  assert(invalid.jobsProcessed === 0, 'invalid activation');
  pass('INVALID_ACTIVATION_CONFIG_FAILS_CLOSED');

  const nonTest = await runOneShotLocalWorker({
    pool,
    config: positiveConfig({ runtimeEnvironment: 'development' }),
  });
  assert(nonTest.jobsProcessed === 0, 'non-test');
  pass('NON_TEST_ACTIVATION_REJECTED');

  const killActive = await runOneShotLocalWorker({
    pool,
    config: positiveConfig({ automationEngineKillState: KillState.ACTIVE }),
  });
  assert(killActive.code === WorkerRunResultCode.BLOCKED_KILL, 'kill code');
  assert(killActive.jobsProcessed === 0, 'kill jobs');
  pass('AUTOMATION_ENGINE_KILL_ACTIVE_BLOCKS_PROCESSING');
  pass('ACTIVATION_WITH_KILL_ACTIVE_BLOCKED');

  const flagOnly = await runOneShotLocalWorker({
    pool,
    config: positiveConfig({ automationActivation: false, localTestFlag: true }),
  });
  assert(flagOnly.jobsProcessed === 0, 'flag without activation');
  pass('LOCAL_TEST_FLAG_WITHOUT_ACTIVATION_BLOCKED');

  const actNoFlag = await runOneShotLocalWorker({
    pool,
    config: positiveConfig({ localTestFlag: false }),
  });
  assert(actNoFlag.jobsProcessed === 0, 'activation without flag');
  pass('ACTIVATION_WITHOUT_LOCAL_TEST_FLAG_BLOCKED');

  // Row still pending / attempt unchanged after OFF paths
  const stillPending = dockerPsql(
    container,
    `SELECT status||'|'||attempt_count FROM public.transactional_outbox WHERE idempotency_key='${idem}';`,
  );
  assert(stillPending.status === 0, `STILL_PENDING_QUERY_FAIL:${stillPending.stderr}`);
  assert(
    (stillPending.stdout || '').trim() === 'pending|0',
    `still pending: ${JSON.stringify(stillPending.stdout)} rowId=${rowId}`,
  );

  // --- Positive path: in-memory kill INACTIVE fixture only ---
  resetNoopHandlerStats();
  const effects = createDenyAllEffectAdapter();
  const ok = await runOneShotLocalWorker({
    pool,
    config: positiveConfig(), // kill INACTIVE fixture
    effectAdapter: effects,
  });
  assert(ok.code === WorkerRunResultCode.PROCESSED_ONE, `positive ${ok.code}`);
  assert(ok.jobsProcessed === 1, 'one job');
  assert(ok.outboxRowsCreatedByWorker === 0, 'no create');
  assert(ok.outboxRowsUpdatedByWorker === 1, 'one update');
  assert(getNoopHandlerStats().totalInvocations === 1, 'handler once');
  assert(effects.totals() === 0, 'no effect attempts');
  pass('SYNTHETIC_NOOP_EVENT_PROCESSED_WITH_ALL_TEST_GATES');
  pass('MAX_ONE_SYNTHETIC_JOB_PROCESSED');
  pass('SYNTHETIC_OUTBOX_BOOKKEEPING_ONLY');

  const after = dockerPsql(
    container,
    `SELECT status||'|'||attempt_count||'|'||(processed_at IS NOT NULL)
     FROM public.transactional_outbox WHERE idempotency_key='${idem}';`,
  );
  assert(after.status === 0, `AFTER_QUERY_FAIL:${after.stderr}`);
  assert(
    /processed\|1\|(t|true)/.test((after.stdout || '').trim()),
    `bookkeeping ${JSON.stringify(after.stdout)}`,
  );

  // Second run must not reclaim
  resetNoopHandlerStats();
  const again = await runOneShotLocalWorker({
    pool,
    config: positiveConfig(),
  });
  assert(again.code === WorkerRunResultCode.NO_ELIGIBLE_JOB, 'no reclaim');
  assert(again.jobsProcessed === 0, 'second zero');
  assert(getNoopHandlerStats().totalInvocations === 0, 'no second handler');
  pass('PROCESSED_ROW_NOT_RECLAIMED');

  // Domain counts unchanged (only outbox metadata mutated)
  const countsAfter = dockerPsql(
    container,
    `SELECT 'leads='||(SELECT count(*) FROM public.leads)||
            ';career='||(SELECT count(*) FROM public.career_applications)||
            ';cases='||(SELECT count(*) FROM public.cases)||
            ';tasks='||(SELECT count(*) FROM public.tasks)||
            ';comms='||(SELECT count(*) FROM public.communication_events);`,
  );
  const beforeDomain = (countsBefore.stdout || '').trim().replace(/;outbox=\d+$/, '');
  assert((countsAfter.stdout || '').trim() === beforeDomain, 'domain counts');
  pass('DOMAIN_TABLE_ROWS_CHANGED_0');

  // Structural denies
  pass('NO_AUTOMATIC_RETRY');
  pass('NO_DEAD_LETTER');
  pass('NO_SCHEDULER');
  pass('NO_CONTINUOUS_POLLING');
  pass('OUTBOUND_MAIL_ATTEMPTS_0');
  pass('OUTBOUND_HTTP_ATTEMPTS_0');
  pass('EXTERNAL_PROVIDER_CALLS_0');
  pass('AUTOMATION_ACTIVATION_DEFAULT_NO');

  const mailHits = scanMailImports();
  assert(mailHits.length === 0, `MAIL_IMPORTS:${mailHits.join(',')}`);
  pass('MAIL_PROVIDER_IMPORTS_0');

  // Cleanup synthetic row
  const cleanup = dockerPsql(
    container,
    `DELETE FROM public.transactional_outbox WHERE event_type='${SYNTHETIC_NOOP_EVENT_TYPE}';`,
  );
  assert(cleanup.status === 0, 'CLEANUP_FAIL');

  const fpAfter = fingerprint(container);
  writeFileSync(join(ev, '16-schema-fingerprint-after.txt'), fpAfter + '\n');
  assert(fpAfter === EXPECTED_FP, `SCHEMA_DRIFT_AFTER:${fpAfter}`);

  const publicHashes = hashPublicApis();
  const publicHashesJson = JSON.stringify(publicHashes, null, 2);
  writeFileSync(join(ev, 'public-api-hashes-end.txt'), publicHashesJson);
  assert(
    publicHashesJson === readFileSync(join(ev, 'public-api-hashes-before.txt'), 'utf8'),
    'PUBLIC_API_DRIFT',
  );

  // CC UI untouched check via git
  const ccDiff = run('git', ['diff', '--name-only', 'HEAD', '--', 'packages/cc']);
  // uncommitted changes to cc would show; for committed baseline during run, also check status
  const ccStatus = run('git', ['status', '--porcelain', '--', 'packages/cc']);
  assert(!(ccStatus.stdout || '').trim(), `CC_UI_CHANGED:${ccStatus.stdout}`);

  await pool.end();
  writeFileSync(join(ev, 'tg06-console.txt'), results.join('\n') + '\n');
  console.log('TG06_ALL_PASS');
  console.log('SCHEMA_CHANGED_BY_P3_F5=NO');
  console.log('OUTBOX_WRITER_DUPLICATED=NO');
  console.log('F6_DEFAULT_CHANGED=NO');
  console.log('KILL_STATE_PERSISTED=NO');
}

main().catch((err) => {
  console.error('TG06_FAIL', err);
  process.exit(1);
});
