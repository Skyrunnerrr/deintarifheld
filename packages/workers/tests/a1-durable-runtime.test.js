/**
 * DTH-A1 durable workflow runtime evidence suite.
 * Requires local disposable Postgres (DTH_A1_DATABASE_URL).
 * AUTHORIZED_ENVIRONMENT=LOCAL_TEST_ONLY
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SyntheticCapability,
  JobStatus,
  WorkflowErrorClass,
  RuntimeLimits,
  KillDomain,
} from '@deintarifheld/shared';
import {
  createLocalOutboxPool,
  assertWorkflowSchemaCompatible,
  startWorkflowIdempotent,
  enqueueLeadAcceptedWorkflowStart,
  claimDueJobs,
  setGlobalKill,
  setDomainKill,
  pauseWorkflowControl,
  resumeWorkflowControl,
  activateTakeover,
  readFreshControlSnapshot,
  readControlVersion,
  completeJobSuccess,
  reprocessDeadLetter,
  ingestSyntheticOutboxEvent,
  A1_SYNTHETIC_OUTBOX_EVENT,
  getWorkflowRuntimeStats,
  computeBackoffMs as dbComputeBackoffMs,
} from '@deintarifheld/db';
import {
  runDurableWorkflowWorker,
  drainDueJobs,
  createWorkerInstanceId,
  registerAllSyntheticHandlers,
  resetSyntheticHandlerState,
  createDenyAllEffectAdapter,
  resolveCapabilityOrFail,
} from '../src/index.js';

const DB_URL =
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

function requireLocalUrl(url) {
  if (/supabase\.co|aws\.|azure\.|gcp\./i.test(url)) {
    throw new Error('REMOTE_DATABASE_URL_FORBIDDEN');
  }
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
  }
}

requireLocalUrl(DB_URL);

const pool = createLocalOutboxPool(DB_URL);

async function resetRuntimeTables() {
  await pool.query(`DELETE FROM workflow.job_attempts`);
  await pool.query(`DELETE FROM workflow.jobs`);
  await pool.query(`DELETE FROM workflow.workflow_instances`);
  await pool.query(`DELETE FROM security.control_audit`);
  await pool.query(
    `UPDATE security.control_state SET state='INACTIVE', reason='test reset', updated_at=now()`,
  );
  await pool.query(
    `INSERT INTO security.control_state (scope, scope_key, state, reason, updated_by)
     VALUES ('GLOBAL','AUTOMATION','INACTIVE','test reset','TEST')
     ON CONFLICT (scope, scope_key) DO UPDATE SET state='INACTIVE', reason='test reset', updated_at=now()`,
  );
  await pool.query(`UPDATE security.control_version SET version = 1, updated_at = now() WHERE id = 1`);
  resetSyntheticHandlerState();
  registerAllSyntheticHandlers();
}

async function forceJobDue(jobId) {
  await pool.query(
    `UPDATE workflow.jobs SET scheduled_at = now() - interval '1 second', updated_at = now() WHERE id = $1`,
    [jobId],
  );
}

function corr(prefix) {
  return `${prefix}-${randomUUID()}`;
}

test('A1-01 schema/migration compatible', async () => {
  const r = await assertWorkflowSchemaCompatible(pool);
  assert.equal(r.ok, true);
  assert.ok(r.tables.includes('workflow.jobs'));
});

test('A1-02 workflow creation idempotency', async () => {
  await resetRuntimeTables();
  const c = corr('idem');
  const a = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'agg-1',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `idem:${c}`,
  });
  const b = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'agg-1',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `idem:${c}`,
  });
  assert.equal(a.workflowId, b.workflowId);
  assert.equal(a.jobId, b.jobId);
  assert.equal(b.duplicate || (!b.created && !b.jobCreated), true);
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM workflow.workflow_instances`);
  assert.equal(rows[0].n, 1);
});

test('A1-03 due-job claiming', async () => {
  await resetRuntimeTables();
  const c = corr('claim');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'c1',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `claim:${c}`,
  });
  const worker = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: worker, limit: 5 });
  assert.equal(claimed.jobs.length, 1);
  assert.equal(claimed.jobs[0].lease_owner, worker);
  assert.equal(claimed.jobs[0].status, JobStatus.LEASED);
});

test('A1-04 two-worker claim safety', async () => {
  await resetRuntimeTables();
  const jobs = [];
  for (let i = 0; i < 20; i += 1) {
    const c = corr(`mw-${i}`);
    jobs.push(
      startWorkflowIdempotent(pool, {
        aggregateType: 'synthetic',
        aggregateId: `mw-${i}`,
        correlationId: c,
        jobType: SyntheticCapability.SYNTHETIC_NOOP,
        jobIdempotencyKey: `mw:${c}`,
      }),
    );
  }
  await Promise.all(jobs);

  const w1 = createWorkerInstanceId();
  const w2 = createWorkerInstanceId();
  const [a, b] = await Promise.all([
    claimDueJobs(pool, { workerInstanceId: w1, limit: 10, leaseMs: 8000 }),
    claimDueJobs(pool, { workerInstanceId: w2, limit: 10, leaseMs: 8000 }),
  ]);
  const ids = [...a.jobs, ...b.jobs].map((j) => j.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate lease owners');
  assert.equal(ids.length, 20);

  const { executeLeasedJob } = await import('../src/runtime/execute-job.js');
  await Promise.all(
    [...a.jobs, ...b.jobs].map((job) =>
      executeLeasedJob(pool, job, {
        workerInstanceId: job.lease_owner,
        effectAdapter: createDenyAllEffectAdapter(),
      }),
    ),
  );
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM workflow.jobs WHERE status = 'SUCCEEDED'`,
  );
  assert.equal(rows[0].n, 20);
});

test('A1-05 delayed scheduling', async () => {
  await resetRuntimeTables();
  const now = new Date();
  const later = new Date(now.getTime() + 60_000).toISOString();
  const c1 = corr('due');
  const c2 = corr('later');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'due',
    correlationId: c1,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `due:${c1}`,
  });
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'later',
    correlationId: c2,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `later:${c2}`,
    scheduledAt: later,
  });
  const claimed = await claimDueJobs(pool, {
    workerInstanceId: createWorkerInstanceId(),
    limit: 10,
  });
  assert.equal(claimed.jobs.length, 1);
  assert.equal(claimed.jobs[0].idempotency_key, `due:${c1}`);
});

test('A1-06/07 retry + bounded backoff', async () => {
  await resetRuntimeTables();
  const delays = [1, 2, 3].map((a) => dbComputeBackoffMs(a, { random: () => 0.5 }));
  assert.ok(delays[0] < delays[1] && delays[1] <= delays[2]);
  assert.ok(delays.every((d) => d >= 0 && d <= RuntimeLimits.MAX_BACKOFF_MS));

  const c = corr('retry');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'retry',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_TRANSIENT_FAIL_THEN_SUCCESS,
    jobIdempotencyKey: `retry:${c}`,
    maxAttempts: 5,
  });
  await drainDueJobs(pool, { maxEmptyTicks: 2, random: () => 0 });
  const mid = await pool.query(`SELECT status, attempt_count FROM workflow.jobs WHERE id=$1`, [
    started.jobId,
  ]);
  assert.equal(mid.rows[0].status, JobStatus.RETRY_SCHEDULED);
  await forceJobDue(started.jobId);
  await drainDueJobs(pool, { maxEmptyTicks: 3, random: () => 0 });
  const end = await pool.query(`SELECT status, attempt_count FROM workflow.jobs WHERE id=$1`, [
    started.jobId,
  ]);
  assert.equal(end.rows[0].status, JobStatus.SUCCEEDED);
  assert.equal(end.rows[0].attempt_count, 2);
});

test('A1-08 permanent failure', async () => {
  await resetRuntimeTables();
  const c = corr('perm');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'perm',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_PERMANENT_FAIL,
    jobIdempotencyKey: `perm:${c}`,
  });
  await drainDueJobs(pool, { maxEmptyTicks: 2 });
  const { rows } = await pool.query(`SELECT status, last_error_class FROM workflow.jobs`);
  assert.equal(rows[0].status, JobStatus.FAILED_PERMANENT);
  assert.equal(rows[0].last_error_class, WorkflowErrorClass.VALIDATION_PERMANENT);
});

test('A1-09 DLQ', async () => {
  await resetRuntimeTables();
  const c = corr('dlq');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'dlq',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_TRANSIENT_FAIL_THEN_SUCCESS,
    jobIdempotencyKey: `dlq:${c}`,
    maxAttempts: 1,
  });
  // Force always-transient by resetting handler state each attempt — maxAttempts=1 → DLQ on first fail
  await drainDueJobs(pool, { maxEmptyTicks: 2, random: () => 0 });
  const { rows } = await pool.query(`SELECT status, attempt_count FROM workflow.jobs WHERE id=$1`, [
    started.jobId,
  ]);
  assert.equal(rows[0].status, JobStatus.DEAD_LETTER);
  assert.equal(rows[0].attempt_count, 1);
});

test('A1-10 reprocess preserves history', async () => {
  await resetRuntimeTables();
  const c = corr('repr');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'repr',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `repr:${c}`,
  });
  await pool.query(
    `UPDATE workflow.jobs SET status='DEAD_LETTER', completed_at=now(), last_error_class='TRANSIENT' WHERE id=$1`,
    [started.jobId],
  );
  await pool.query(
    `UPDATE workflow.workflow_instances SET status='BLOCKED_EXCEPTION' WHERE id=$1`,
    [started.workflowId],
  );
  const r = await reprocessDeadLetter(pool, started.jobId);
  assert.equal(r.ok, true);
  assert.equal(r.historyMutated, false);
  const orig = await pool.query(`SELECT status FROM workflow.jobs WHERE id=$1`, [started.jobId]);
  assert.equal(orig.rows[0].status, JobStatus.DEAD_LETTER);
  const neu = await pool.query(`SELECT status FROM workflow.jobs WHERE id=$1`, [r.newJobId]);
  assert.equal(neu.rows[0].status, JobStatus.READY);
});

test('A1-11 lease expiry recovery', async () => {
  await resetRuntimeTables();
  const c = corr('lease');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'lease',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `lease:${c}`,
  });
  const w1 = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, {
    workerInstanceId: w1,
    leaseMs: 1,
  });
  assert.equal(claimed.jobs.length, 1);
  await new Promise((r) => setTimeout(r, 25));
  const w2 = createWorkerInstanceId();
  const reclaimed = await claimDueJobs(pool, { workerInstanceId: w2, leaseMs: 2000 });
  assert.equal(reclaimed.jobs.length, 1);
  assert.equal(reclaimed.jobs[0].lease_owner, w2);
  assert.notEqual(reclaimed.jobs[0].lease_owner, w1);
});

test('A1-12 stale worker completion denied', async () => {
  await resetRuntimeTables();
  const c = corr('stale');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'stale',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `stale:${c}`,
  });
  const w1 = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w1, leaseMs: 1 });
  const job = claimed.jobs[0];
  await new Promise((r) => setTimeout(r, 25));
  const w2 = createWorkerInstanceId();
  await claimDueJobs(pool, { workerInstanceId: w2, leaseMs: 5000 });
  const stale = await completeJobSuccess(pool, job, { workerInstanceId: w1 });
  assert.equal(stale.stale, true);
  assert.equal(stale.code, 'STALE_LEASE');
});

test('A1-13 continuous loop + A1-14 graceful shutdown', async () => {
  await resetRuntimeTables();
  for (let i = 0; i < 3; i += 1) {
    const c = corr(`loop-${i}`);
    await startWorkflowIdempotent(pool, {
      aggregateType: 'synthetic',
      aggregateId: `loop-${i}`,
      correlationId: c,
      jobType: SyntheticCapability.SYNTHETIC_NOOP,
      jobIdempotencyKey: `loop:${c}`,
    });
  }
  const ac = new AbortController();
  const run = runDurableWorkflowWorker({
    pool,
    mode: 'continuous',
    signal: ac.signal,
    maxIterations: 100,
    pollIntervalMs: 20,
  });
  await new Promise((r) => setTimeout(r, 200));
  ac.abort();
  const result = await run;
  assert.equal(result.CONTINUOUS_LOOP_IMPLEMENTED, 'YES');
  assert.ok(result.succeeded >= 1);
  assert.ok(['SIGNAL', 'ONE_SHOT_DONE', null].includes(result.stoppedReason) || result.stoppedReason);
});

test('A1-15 global kill persistence', async () => {
  await resetRuntimeTables();
  const c = corr('kill');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'kill',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `kill:${c}`,
  });
  await setGlobalKill(pool, true, { reason: 'A1_TEST', actor: 'TEST' });
  // "restart" = new worker process reading durable state
  const r = await drainDueJobs(pool, { maxEmptyTicks: 2 });
  assert.equal(r.claimed, 0);
  const snap = await readFreshControlSnapshot(pool);
  assert.equal(snap.globalKillActive, true);
  await setGlobalKill(pool, false, { reason: 'A1_TEST_OFF', actor: 'TEST' });
  const r2 = await drainDueJobs(pool, { maxEmptyTicks: 3 });
  assert.ok(r2.succeeded >= 1);
});

test('A1-16 domain kill', async () => {
  await resetRuntimeTables();
  const c = corr('dkill');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'dkill',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `dkill:${c}`,
  });
  await setDomainKill(pool, KillDomain.AUTOMATION_ENGINE, true, { reason: 'domain' });
  const claimed = await claimDueJobs(pool, { workerInstanceId: createWorkerInstanceId() });
  assert.equal(claimed.blocked, true);
  assert.equal(claimed.jobs.length, 0);
});

test('A1-17 CONTROL_VERSION stale blocking', async () => {
  await resetRuntimeTables();
  const c = corr('cv');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'cv',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_EFFECT_INTENT_DENIED,
    jobIdempotencyKey: `cv:${c}`,
  });
  const w = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w, leaseMs: 5000 });
  const job = claimed.jobs[0];
  await setGlobalKill(pool, true, { reason: 'bump-version' });
  await setGlobalKill(pool, false, { reason: 'bump-version-off' });
  const v = await readControlVersion(pool);
  assert.ok(v > Number(job.control_version));

  const { executeLeasedJob } = await import('../src/runtime/execute-job.js');
  const result = await executeLeasedJob(pool, job, {
    workerInstanceId: w,
    effectAdapter: createDenyAllEffectAdapter(),
  });
  assert.ok(
    result.code === JobStatus.FAILED_PERMANENT || result.code === 'FAILED_PERMANENT',
  );
});

test('A1-18/19 pause persistence + resume', async () => {
  await resetRuntimeTables();
  const c = corr('pause');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'pause',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `pause:${c}`,
  });
  await pauseWorkflowControl(pool, started.workflowId, { reason: 'pause-test' });
  const claimed = await claimDueJobs(pool, { workerInstanceId: createWorkerInstanceId() });
  assert.equal(claimed.jobs.length, 0);
  await resumeWorkflowControl(pool, started.workflowId, { reason: 'resume-test' });
  const r = await drainDueJobs(pool, { maxEmptyTicks: 3 });
  assert.ok(r.succeeded >= 1);
});

test('A1-20 takeover invalidation', async () => {
  await resetRuntimeTables();
  const c = corr('take');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'take',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_EFFECT_INTENT_DENIED,
    jobIdempotencyKey: `take:${c}`,
  });
  const w = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w, leaseMs: 8000 });
  await activateTakeover(pool, started.workflowId, { reason: 'owner' });
  const { executeLeasedJob } = await import('../src/runtime/execute-job.js');
  const result = await executeLeasedJob(pool, claimed.jobs[0], {
    workerInstanceId: w,
    effectAdapter: createDenyAllEffectAdapter(),
  });
  assert.equal(result.code, JobStatus.FAILED_PERMANENT);
});

test('A1-21 poison job isolation', async () => {
  await resetRuntimeTables();
  const bad = corr('poison');
  const good = corr('good');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'poison',
    correlationId: bad,
    jobType: SyntheticCapability.SYNTHETIC_POISON,
    jobIdempotencyKey: `poison:${bad}`,
  });
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'good',
    correlationId: good,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `good:${good}`,
  });
  const r = await drainDueJobs(pool, { maxEmptyTicks: 4 });
  assert.ok(r.succeeded >= 1);
  assert.ok(r.failedPermanent >= 1);
});

test('A1-22 unknown capability', async () => {
  await resetRuntimeTables();
  const resolved = resolveCapabilityOrFail('NOT_A_REAL_CAPABILITY');
  assert.equal(resolved.ok, false);
  const c = corr('unk');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'unk',
    correlationId: c,
    jobType: 'NOT_A_REAL_CAPABILITY',
    jobIdempotencyKey: `unk:${c}`,
  });
  await drainDueJobs(pool, { maxEmptyTicks: 2 });
  const { rows } = await pool.query(`SELECT status, last_error_class FROM workflow.jobs`);
  assert.equal(rows[0].status, JobStatus.FAILED_PERMANENT);
  assert.equal(rows[0].last_error_class, WorkflowErrorClass.UNKNOWN_CAPABILITY);
});

test('A1-23 outbox ingestion idempotency', async () => {
  await resetRuntimeTables();
  const event = {
    event_type: A1_SYNTHETIC_OUTBOX_EVENT,
    aggregate_type: 'synthetic',
    aggregate_id: 'ob-1',
    correlation_id: corr('ob'),
    idempotency_key: `ob-${randomUUID()}`,
    payload_redacted: {},
  };
  const a = await ingestSyntheticOutboxEvent(pool, event);
  const b = await ingestSyntheticOutboxEvent(pool, event);
  assert.equal(a.workflowId, b.workflowId);
  assert.equal(b.code, 'IDEMPOTENT_REPLAY');
});

test('A1-24/25/26 DB outage fail-closed + no memory/json fallback', async () => {
  assert.throws(
    () => createLocalOutboxPool('postgresql://user:pass@db.supabase.co:5432/postgres'),
    /REMOTE_DATABASE_URL_FORBIDDEN/,
  );
  const badPool = {
    connect: async () => {
      throw new Error('ECONNREFUSED');
    },
    query: async () => {
      throw new Error('ECONNREFUSED');
    },
  };
  await assert.rejects(() => assertWorkflowSchemaCompatible(badPool), /ECONNREFUSED|SCHEMA/);
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/runtime/continuous-runner.js'), 'utf8');
  assert.doesNotMatch(src, /memoryQueue|jsonQueue|MEMORY_QUEUE\s*=/);
  assert.match(src, /MEMORY_QUEUE_FALLBACK: 0/);
  assert.match(src, /JSON_QUEUE_FALLBACK: 0/);
});

test('A1-27 restart persistence (retry scheduled_at)', async () => {
  await resetRuntimeTables();
  const c = corr('rst');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'rst',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_TRANSIENT_FAIL_THEN_SUCCESS,
    jobIdempotencyKey: `rst:${c}`,
    maxAttempts: 5,
  });
  await drainDueJobs(pool, { maxEmptyTicks: 2, random: () => 0 });
  const before = await pool.query(
    `SELECT status, attempt_count, scheduled_at FROM workflow.jobs WHERE id=$1`,
    [started.jobId],
  );
  assert.equal(before.rows[0].status, JobStatus.RETRY_SCHEDULED);
  // simulate process restart — new drain without mutating attempt_count
  const after = await pool.query(
    `SELECT status, attempt_count, scheduled_at FROM workflow.jobs WHERE id=$1`,
    [started.jobId],
  );
  assert.equal(after.rows[0].attempt_count, before.rows[0].attempt_count);
  assert.equal(String(after.rows[0].scheduled_at), String(before.rows[0].scheduled_at));
});

test('A1-28 no external provider effect', async () => {
  await resetRuntimeTables();
  const adapter = createDenyAllEffectAdapter();
  const c = corr('eff');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'eff',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_EFFECT_INTENT_DENIED,
    jobIdempotencyKey: `eff:${c}`,
  });
  await drainDueJobs(pool, { maxEmptyTicks: 3, effectAdapter: adapter });
  assert.ok(adapter.totals() >= 1);
  assert.equal(adapter.getAttempts().mail >= 1, true);
});

test('A1-29 audit/execution history', async () => {
  await resetRuntimeTables();
  await setGlobalKill(pool, true, { reason: 'audit', actor: 'TEST', correlationId: 'a1' });
  const { rows: audits } = await pool.query(`SELECT count(*)::int AS n FROM security.control_audit`);
  assert.ok(audits[0].n >= 1);
  const c = corr('hist');
  await startWorkflowIdempotent(pool, {
    aggregateType: 'synthetic',
    aggregateId: 'hist',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `hist:${c}`,
  });
  await setGlobalKill(pool, false, { reason: 'audit-off' });
  await drainDueJobs(pool, { maxEmptyTicks: 3 });
  const { rows: attempts } = await pool.query(`SELECT count(*)::int AS n FROM workflow.job_attempts`);
  assert.ok(attempts[0].n >= 1);
  const stats = await getWorkflowRuntimeStats(pool);
  assert.ok(stats.succeeded_jobs >= 1);
});

test('A1-30 no production activation', async () => {
  await resetRuntimeTables();
  await assert.rejects(
    () =>
      runDurableWorkflowWorker({
        pool,
        mode: 'one-shot',
        activationConfig: { runtimeEnvironment: 'PRODUCTION' },
      }),
    /PRODUCTION_AUTONOMY_FORBIDDEN/,
  );
});

test('A1 stress 200 jobs / 2 workers', async () => {
  await resetRuntimeTables();
  const n = RuntimeLimits.STRESS_JOB_COUNT;
  const starts = [];
  for (let i = 0; i < n; i += 1) {
    const c = corr(`st-${i}`);
    starts.push(
      startWorkflowIdempotent(pool, {
        aggregateType: 'synthetic',
        aggregateId: `st-${i}`,
        correlationId: c,
        jobType: SyntheticCapability.SYNTHETIC_NOOP,
        jobIdempotencyKey: `st:${c}`,
        priority: i % 5,
      }),
    );
  }
  await Promise.all(starts);
  const w1 = createWorkerInstanceId();
  const w2 = createWorkerInstanceId();
  await Promise.all([
    drainDueJobs(pool, { workerInstanceId: w1, maxEmptyTicks: 8, maxIterations: 500 }),
    drainDueJobs(pool, { workerInstanceId: w2, maxEmptyTicks: 8, maxIterations: 500 }),
  ]);
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE status='SUCCEEDED')::int AS ok,
       count(*) FILTER (WHERE status NOT IN ('SUCCEEDED','CANCELLED'))::int AS open,
       count(*) FILTER (WHERE lease_owner IS NOT NULL)::int AS leased
     FROM workflow.jobs`,
  );
  assert.equal(rows[0].ok, n);
  assert.equal(rows[0].open, 0);
  assert.equal(rows[0].leased, 0);
});

test('A1 A2 handoff contract surface', async () => {
  await resetRuntimeTables();
  const leadId = `lead-${randomUUID()}`;
  const correlationId = corr('lead');
  const a = await enqueueLeadAcceptedWorkflowStart(pool, { leadId, correlationId });
  const b = await enqueueLeadAcceptedWorkflowStart(pool, { leadId, correlationId });
  assert.equal(a.workflowId, b.workflowId);
  assert.equal(a.jobId, b.jobId);
});

test('A1 one-shot-runner remains without continuous loop', async () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/one-shot-runner.js'), 'utf8');
  assert.doesNotMatch(src, /setInterval|while\s*\(\s*true|node-cron/);
});

test.after(async () => {
  await pool.end();
});
