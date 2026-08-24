/**
 * Retry / backoff / DLQ / complete / reprocess transitions.
 */
import {
  JobStatus,
  RuntimeLimits,
  WorkflowErrorClass,
  isRetryableErrorClass,
} from '@deintarifheld/shared';
import { createFollowOnJob, completeWorkflowIfTerminal, markWorkflowBlocked } from './instances.js';
import { isPgPool } from '../pg-pool-or-client.js';

/**
 * Deterministic bounded exponential backoff with optional jitter source.
 * delay = min(maxBackoff, base * 2^(attempt-1)) +/- jitter
 */
export function computeBackoffMs(attempt, {
  baseMs = RuntimeLimits.BASE_BACKOFF_MS,
  maxMs = RuntimeLimits.MAX_BACKOFF_MS,
  random = Math.random,
} = {}) {
  const exp = Math.max(0, attempt - 1);
  const raw = baseMs * 2 ** exp;
  const capped = Math.min(maxMs, raw);
  const jitter = Math.floor((random() * 2 - 1) * (capped * 0.1));
  return Math.max(0, capped + jitter);
}

async function finishAttempt(client, job, result, errorClass, errorCode, nowIso) {
  await client.query(
    `UPDATE workflow.job_attempts
     SET finished_at = COALESCE($4::timestamptz, now()),
         result = $5,
         error_class = $6,
         error_code = $7
     WHERE job_id = $1 AND attempt_number = $2 AND worker_id = $3
       AND finished_at IS NULL`,
    [
      job.id,
      job.attempt_count,
      job.lease_owner,
      nowIso,
      result,
      errorClass ?? null,
      errorCode ?? null,
    ],
  );
}

/**
 * Complete job under lease ownership CAS. Stale workers get 0 rows.
 */
export async function completeJobSuccess(pool, job, {
  workerInstanceId,
  nextJob = null,
  completeWorkflow = false,
  workflowState = 'COMPLETED',
  nowIso = null,
  failureInjector = null,
} = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (failureInjector?.beforeCompletionCommit) {
      await failureInjector.beforeCompletionCommit();
    }

    const { rowCount, rows } = await client.query(
      `UPDATE workflow.jobs
       SET status = 'SUCCEEDED',
           lease_owner = NULL,
           lease_expires_at = NULL,
           completed_at = COALESCE($4::timestamptz, now()),
           last_error_class = NULL,
           last_error_code = NULL,
           updated_at = now()
       WHERE id = $1
         AND lease_owner = $2
         AND lease_generation = $3
         AND status IN ('LEASED','RUNNING')
         AND lease_expires_at > COALESCE($4::timestamptz, now())
       RETURNING *`,
      [job.id, workerInstanceId, job.lease_generation, nowIso],
    );

    if (rowCount !== 1) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'STALE_LEASE', stale: true };
    }

    await finishAttempt(client, rows[0], 'SUCCEEDED', null, null, nowIso);

    let next = null;
    if (nextJob) {
      next = await createFollowOnJob(client, {
        workflowInstanceId: job.workflow_instance_id,
        controlVersion: job.control_version,
        correlationId: job.correlation_id,
        ...nextJob,
      });
    }

    if (completeWorkflow) {
      await completeWorkflowIfTerminal(client, job.workflow_instance_id, workflowState);
    }

    await client.query('COMMIT');
    return { ok: true, code: 'SUCCEEDED', nextJobId: next?.id ?? null };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function scheduleRetryOrDeadLetter(pool, job, {
  workerInstanceId,
  errorClass,
  errorCode,
  nowIso = null,
  random = Math.random,
  failureInjector = null,
} = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const retryable = isRetryableErrorClass(errorClass);
    const underMax = job.attempt_count < job.max_attempts;
    const goRetry = retryable && underMax;

    if (goRetry && failureInjector?.beforeRetryCommit) {
      await failureInjector.beforeRetryCommit();
    }
    if (!goRetry && failureInjector?.beforeDlqCommit) {
      await failureInjector.beforeDlqCommit();
    }

    const backoffMs = goRetry
      ? computeBackoffMs(job.attempt_count, { random })
      : 0;
    const nextStatus = goRetry ? JobStatus.RETRY_SCHEDULED : JobStatus.DEAD_LETTER;
    const attemptResult = goRetry ? 'RETRY_SCHEDULED' : 'DEAD_LETTER';

    const { rowCount, rows } = await client.query(
      `UPDATE workflow.jobs
       SET status = $5,
           lease_owner = NULL,
           lease_expires_at = NULL,
           scheduled_at = CASE
             WHEN $5 = 'RETRY_SCHEDULED'
             THEN COALESCE($4::timestamptz, now()) + ($6::text || ' milliseconds')::interval
             ELSE scheduled_at
           END,
           last_error_class = $7,
           last_error_code = $8,
           completed_at = CASE WHEN $5 = 'DEAD_LETTER' THEN COALESCE($4::timestamptz, now()) ELSE completed_at END,
           updated_at = now()
       WHERE id = $1
         AND lease_owner = $2
         AND lease_generation = $3
         AND status IN ('LEASED','RUNNING')
       RETURNING *`,
      [
        job.id,
        workerInstanceId,
        job.lease_generation,
        nowIso,
        nextStatus,
        String(backoffMs),
        errorClass,
        errorCode ?? null,
      ],
    );

    if (rowCount !== 1) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'STALE_LEASE', stale: true };
    }

    await finishAttempt(client, rows[0], attemptResult, errorClass, errorCode, nowIso);

    if (nextStatus === JobStatus.DEAD_LETTER) {
      await markWorkflowBlocked(client, job.workflow_instance_id, errorClass, errorCode);
    }

    await client.query('COMMIT');
    return {
      ok: true,
      code: nextStatus,
      backoffMs,
      attemptCount: rows[0].attempt_count,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function failPermanent(pool, job, {
  workerInstanceId,
  errorClass = WorkflowErrorClass.VALIDATION_PERMANENT,
  errorCode,
  nowIso = null,
} = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount, rows } = await client.query(
      `UPDATE workflow.jobs
       SET status = 'FAILED_PERMANENT',
           lease_owner = NULL,
           lease_expires_at = NULL,
           last_error_class = $4,
           last_error_code = $5,
           completed_at = COALESCE($6::timestamptz, now()),
           updated_at = now()
       WHERE id = $1
         AND lease_owner = $2
         AND lease_generation = $3
         AND status IN ('LEASED','RUNNING')
       RETURNING *`,
      [job.id, workerInstanceId, job.lease_generation, errorClass, errorCode ?? null, nowIso],
    );
    if (rowCount !== 1) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'STALE_LEASE', stale: true };
    }
    await finishAttempt(client, rows[0], 'FAILED_PERMANENT', errorClass, errorCode, nowIso);
    await markWorkflowBlocked(client, job.workflow_instance_id, errorClass, errorCode);
    await client.query('COMMIT');
    return { ok: true, code: JobStatus.FAILED_PERMANENT };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelJob(pool, jobId, { reason } = {}) {
  const { rowCount } = await pool.query(
    `UPDATE workflow.jobs
     SET status = 'CANCELLED',
         lease_owner = NULL,
         lease_expires_at = NULL,
         last_error_code = $2,
         cancelled_at = now(),
         updated_at = now()
     WHERE id = $1 AND status NOT IN ('SUCCEEDED','CANCELLED')`,
    [jobId, reason ?? 'CANCELLED'],
  );
  return rowCount === 1;
}

/**
 * Reprocess dead-letter: preserve history; new job generation with new idempotency key.
 * Respects current control version.
 */
export async function reprocessDeadLetter(poolOrClient, jobId, {
  actor = 'LOCAL_TEST',
  correlationId = null,
} = {}) {
  const run = async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM workflow.jobs WHERE id = $1 FOR UPDATE`,
      [jobId],
    );
    const job = rows[0];
    if (!job || job.status !== JobStatus.DEAD_LETTER) {
      return { ok: false, code: 'NOT_DEAD_LETTER' };
    }

    const versionRes = await client.query(
      `SELECT version FROM security.control_version WHERE id = 1`,
    );
    const controlVersion = Number(versionRes.rows[0].version);

    const wf = await client.query(
      `SELECT status FROM workflow.workflow_instances WHERE id = $1`,
      [job.workflow_instance_id],
    );
    if (wf.rows[0]?.status === 'PAUSED' || wf.rows[0]?.status === 'CANCELLED') {
      return { ok: false, code: 'WORKFLOW_NOT_RUNNABLE' };
    }

    const global = await client.query(
      `SELECT state FROM security.control_state WHERE scope='GLOBAL' AND scope_key='AUTOMATION'`,
    );
    if (global.rows[0]?.state === 'ACTIVE') {
      return { ok: false, code: 'GLOBAL_KILL_ACTIVE' };
    }

    await client.query(
      `UPDATE workflow.workflow_instances
       SET status = 'RUNNING', failure_class = NULL, failure_code = NULL, updated_at = now()
       WHERE id = $1 AND status = 'BLOCKED_EXCEPTION'`,
      [job.workflow_instance_id],
    );

    const newKey = `reprocess:${job.id}:${Date.now()}:${actor}`;
    const ins = await client.query(
      `INSERT INTO workflow.jobs
        (workflow_instance_id, job_type, status, priority, scheduled_at,
         max_attempts, attempt_count, idempotency_key, correlation_id,
         control_version, payload_redacted)
       VALUES ($1,$2,'READY',$3,now(),$4,0,$5,$6,$7,$8::jsonb)
       RETURNING id`,
      [
        job.workflow_instance_id,
        job.job_type,
        job.priority,
        job.max_attempts,
        newKey,
        correlationId || job.correlation_id,
        controlVersion,
        JSON.stringify(job.payload_redacted || {}),
      ],
    );

    return {
      ok: true,
      code: 'REPROCESS_CREATED',
      originalJobId: job.id,
      newJobId: ins.rows[0].id,
      historyMutated: false,
    };
  };

  if (!isPgPool(poolOrClient)) {
    return run(poolOrClient);
  }

  const client = await poolOrClient.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    if (!result.ok) {
      await client.query('ROLLBACK');
      return result;
    }
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function blockJobForControl(pool, job, {
  workerInstanceId,
  code,
  errorClass = WorkflowErrorClass.CONTROL_BLOCKED,
} = {}) {
  return failPermanent(pool, job, {
    workerInstanceId,
    errorClass,
    errorCode: code,
  });
}
