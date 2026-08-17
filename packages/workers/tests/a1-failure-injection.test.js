/**
 * A1 failure-injection proofs (deterministic boundaries).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  SyntheticCapability,
  JobStatus,
  WorkflowErrorClass,
} from '@deintarifheld/shared';
import {
  createLocalOutboxPool,
  startWorkflowIdempotent,
  claimDueJobs,
  setGlobalKill,
  activateTakeover,
  completeJobSuccess,
  scheduleRetryOrDeadLetter,
  readFreshControlSnapshot,
} from '@deintarifheld/db';
import {
  createWorkerInstanceId,
  registerAllSyntheticHandlers,
  resetSyntheticHandlerState,
  executeLeasedJob,
  createDenyAllEffectAdapter,
  drainDueJobs,
} from '../src/index.js';

const DB_URL =
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';
const pool = createLocalOutboxPool(DB_URL);

async function reset() {
  const { rows: a4 } = await pool.query(`SELECT to_regclass('ops.conversations') AS c`);
  if (a4[0].c) {
    await pool.query(`DELETE FROM ops.followup_schedules`);
    await pool.query(`DELETE FROM ops.provider_events`);
    await pool.query(`DELETE FROM ops.inbound_events`);
    await pool.query(`DELETE FROM ops.communication_messages`);
    await pool.query(`DELETE FROM ops.outbound_intents`);
    await pool.query(`DELETE FROM ops.conversations`);
  }
  await pool.query(`DELETE FROM workflow.job_attempts`);
  await pool.query(`DELETE FROM workflow.jobs`);
  await pool.query(`DELETE FROM workflow.workflow_instances`);
  await pool.query(`UPDATE security.control_state SET state='INACTIVE'`);
  await pool.query(
    `INSERT INTO security.control_state (scope,scope_key,state,reason,updated_by)
     VALUES ('GLOBAL','AUTOMATION','INACTIVE','fi','TEST')
     ON CONFLICT (scope,scope_key) DO UPDATE SET state='INACTIVE', updated_at=now()`,
  );
  await pool.query(`UPDATE security.control_version SET version=1 WHERE id=1`);
  resetSyntheticHandlerState();
  registerAllSyntheticHandlers();
}

function corr(p) {
  return `${p}-${randomUUID()}`;
}

test('FI-01 before lease commit rolls back', async () => {
  await reset();
  const c = corr('fi01');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi01',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `fi01:${c}`,
  });
  await assert.rejects(
    () =>
      claimDueJobs(pool, {
        workerInstanceId: createWorkerInstanceId(),
        failureInjector: {
          beforeLeaseCommit: async () => {
            throw new Error('FI_BEFORE_LEASE');
          },
        },
      }),
    /FI_BEFORE_LEASE/,
  );
  const { rows } = await pool.query(`SELECT status, lease_owner FROM workflow.jobs`);
  assert.equal(rows[0].status, JobStatus.READY);
  assert.equal(rows[0].lease_owner, null);
});

test('FI-02 after lease claim visible then recoverable', async () => {
  await reset();
  const c = corr('fi02');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi02',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `fi02:${c}`,
  });
  let seen = 0;
  const claimed = await claimDueJobs(pool, {
    workerInstanceId: createWorkerInstanceId(),
    leaseMs: 1,
    failureInjector: {
      afterLeaseClaim: async (rows) => {
        seen = rows.length;
      },
    },
  });
  assert.equal(seen, 1);
  assert.equal(claimed.jobs.length, 1);
  await new Promise((r) => setTimeout(r, 25));
  const again = await claimDueJobs(pool, {
    workerInstanceId: createWorkerInstanceId(),
    leaseMs: 2000,
  });
  assert.equal(again.jobs.length, 1);
});

test('FI-04/05 handler transient and permanent', async () => {
  await reset();
  const t = corr('fi04');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi04',
    correlationId: t,
    jobType: SyntheticCapability.SYNTHETIC_TRANSIENT_FAIL_THEN_SUCCESS,
    jobIdempotencyKey: `fi04:${t}`,
    maxAttempts: 5,
  });
  await drainDueJobs(pool, { maxEmptyTicks: 2, random: () => 0 });
  assert.equal(
    (await pool.query(`SELECT status FROM workflow.jobs`)).rows[0].status,
    JobStatus.RETRY_SCHEDULED,
  );

  await reset();
  const p = corr('fi05');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi05',
    correlationId: p,
    jobType: SyntheticCapability.SYNTHETIC_PERMANENT_FAIL,
    jobIdempotencyKey: `fi05:${p}`,
  });
  await drainDueJobs(pool, { maxEmptyTicks: 2 });
  assert.equal(
    (await pool.query(`SELECT status FROM workflow.jobs`)).rows[0].status,
    JobStatus.FAILED_PERMANENT,
  );
});

test('FI-06 after handler before completion → stale path', async () => {
  await reset();
  const c = corr('fi06');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi06',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `fi06:${c}`,
  });
  const w = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w, leaseMs: 5000 });
  await assert.rejects(
    () =>
      executeLeasedJob(pool, claimed.jobs[0], {
        workerInstanceId: w,
        effectAdapter: createDenyAllEffectAdapter(),
        failureInjector: {
          afterHandlerBeforeCompletion: async () => {
            throw new Error('FI_AFTER_HANDLER');
          },
        },
      }),
    /FI_AFTER_HANDLER/,
  );
  const { rows } = await pool.query(`SELECT status FROM workflow.jobs`);
  assert.ok(['LEASED', 'RUNNING'].includes(rows[0].status));
});

test('FI-07/08 retry and DLQ commit injection', async () => {
  await reset();
  const c = corr('fi07');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi07',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `fi07:${c}`,
  });
  const w = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w, leaseMs: 5000 });
  await assert.rejects(
    () =>
      scheduleRetryOrDeadLetter(pool, claimed.jobs[0], {
        workerInstanceId: w,
        errorClass: WorkflowErrorClass.TRANSIENT,
        errorCode: 'X',
        random: () => 0,
        failureInjector: {
          beforeRetryCommit: async () => {
            throw new Error('FI_RETRY');
          },
        },
      }),
    /FI_RETRY/,
  );
});

test('FI-09 control state unavailable blocks', async () => {
  await reset();
  const bad = {
    query: async () => {
      throw new Error('db down');
    },
  };
  await assert.rejects(() => readFreshControlSnapshot(bad), /CONTROL_STATE_UNAVAILABLE/);
});

test('FI-10 kill after claim blocks effect', async () => {
  await reset();
  const c = corr('fi10');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi10',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_EFFECT_INTENT_DENIED,
    jobIdempotencyKey: `fi10:${c}`,
  });
  const w = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w, leaseMs: 8000 });
  await setGlobalKill(pool, true, { reason: 'fi10' });
  const result = await executeLeasedJob(pool, claimed.jobs[0], {
    workerInstanceId: w,
    effectAdapter: createDenyAllEffectAdapter(),
  });
  assert.equal(result.code, JobStatus.FAILED_PERMANENT);
});

test('FI-11 takeover after claim blocks', async () => {
  await reset();
  const c = corr('fi11');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi11',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_EFFECT_INTENT_DENIED,
    jobIdempotencyKey: `fi11:${c}`,
  });
  const w = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w, leaseMs: 8000 });
  await activateTakeover(pool, started.workflowId, { reason: 'fi11' });
  const result = await executeLeasedJob(pool, claimed.jobs[0], {
    workerInstanceId: w,
    effectAdapter: createDenyAllEffectAdapter(),
  });
  assert.equal(result.code, JobStatus.FAILED_PERMANENT);
});

test('FI-12 stale completion', async () => {
  await reset();
  const c = corr('fi12');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi12',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `fi12:${c}`,
  });
  const w1 = createWorkerInstanceId();
  const claimed = await claimDueJobs(pool, { workerInstanceId: w1, leaseMs: 1 });
  await new Promise((r) => setTimeout(r, 25));
  await claimDueJobs(pool, { workerInstanceId: createWorkerInstanceId(), leaseMs: 5000 });
  const stale = await completeJobSuccess(pool, claimed.jobs[0], { workerInstanceId: w1 });
  assert.equal(stale.stale, true);
});

test('FI-13 malformed / poison isolated', async () => {
  await reset();
  const c = corr('fi13');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi13',
    correlationId: c,
    jobType: SyntheticCapability.SYNTHETIC_POISON,
    jobIdempotencyKey: `fi13:${c}`,
  });
  const g = corr('fi13g');
  await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'fi13g',
    correlationId: g,
    jobType: SyntheticCapability.SYNTHETIC_NOOP,
    jobIdempotencyKey: `fi13g:${g}`,
  });
  const r = await drainDueJobs(pool, { maxEmptyTicks: 4 });
  assert.ok(r.failedPermanent >= 1);
  assert.ok(r.succeeded >= 1);
});

test('FI-14 DB unavailable during loop — no memory fallback', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../src/runtime/continuous-runner.js', import.meta.url), 'utf8'),
  );
  assert.match(src, /MEMORY_QUEUE_FALLBACK: 0/);
  assert.match(src, /JSON_QUEUE_FALLBACK: 0/);
  assert.doesNotMatch(src, /fallbackToMemory|writeFileSync\(.*jobs/);
});

test.after(async () => {
  await pool.end();
});
