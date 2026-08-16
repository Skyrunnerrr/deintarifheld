/**
 * Lease-based job claiming — FOR UPDATE SKIP LOCKED, fair ordering.
 */
import { JobStatus, RuntimeLimits, KillDomain } from '@deintarifheld/shared';
import { readFreshControlSnapshot } from './control.js';

/**
 * Reclaim expired leases back to READY before claim.
 */
export async function reclaimExpiredLeases(client, nowIso = null) {
  const { rowCount } = await client.query(
    `UPDATE workflow.jobs
     SET status = 'READY',
         lease_owner = NULL,
         lease_expires_at = NULL,
         updated_at = now()
     WHERE status IN ('LEASED','RUNNING')
       AND lease_expires_at IS NOT NULL
       AND lease_expires_at < COALESCE($1::timestamptz, now())`,
    [nowIso],
  );
  return rowCount;
}

/**
 * Claim up to `limit` due jobs for workerInstanceId.
 * Respects global kill / domain AUTOMATION_ENGINE / paused workflows.
 */
export async function claimDueJobs(pool, {
  workerInstanceId,
  limit = RuntimeLimits.CLAIM_BATCH_SIZE,
  leaseMs = RuntimeLimits.LEASE_MS,
  nowIso = null,
  failureInjector = null,
} = {}) {
  if (!workerInstanceId) throw new Error('WORKER_INSTANCE_ID_REQUIRED');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (failureInjector?.beforeLeaseCommit) {
      await failureInjector.beforeLeaseCommit();
    }

    const snap = await readFreshControlSnapshot(client, {
      domain: KillDomain.AUTOMATION_ENGINE,
    });
    if (!snap.mayClaim) {
      await client.query('ROLLBACK');
      return { jobs: [], blocked: true, snap, reason: 'CONTROL_BLOCKED' };
    }

    await reclaimExpiredLeases(client, nowIso);

    const { rows: picks } = await client.query(
      `SELECT j.id
       FROM workflow.jobs j
       JOIN workflow.workflow_instances w ON w.id = j.workflow_instance_id
       WHERE j.status IN ('READY','RETRY_SCHEDULED')
         AND j.scheduled_at <= COALESCE($1::timestamptz, now())
         AND w.status = 'RUNNING'
         AND NOT EXISTS (
           SELECT 1 FROM security.control_state cs
           WHERE cs.scope = 'WORKFLOW' AND cs.scope_key = j.workflow_instance_id::text
             AND cs.state IN ('PAUSED','TAKEOVER')
         )
       ORDER BY j.priority DESC, j.scheduled_at ASC, j.created_at ASC, j.id ASC
       LIMIT $2
       FOR UPDATE OF j SKIP LOCKED`,
      [nowIso, limit],
    );

    if (!picks.length) {
      await client.query('COMMIT');
      return { jobs: [], blocked: false, snap };
    }

    const ids = picks.map((r) => r.id);
    const { rows } = await client.query(
      `UPDATE workflow.jobs
       SET status = 'LEASED',
           lease_owner = $2,
           lease_expires_at = COALESCE($3::timestamptz, now()) + ($4::text || ' milliseconds')::interval,
           lease_generation = lease_generation + 1,
           attempt_count = attempt_count + 1,
           control_version = $5,
           updated_at = now()
       WHERE id = ANY($1::uuid[])
       RETURNING *`,
      [ids, workerInstanceId, nowIso, String(leaseMs), snap.controlVersion],
    );

    for (const job of rows) {
      await client.query(
        `INSERT INTO workflow.job_attempts
          (job_id, attempt_number, worker_id, lease_generation, started_at)
         VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now()))
         ON CONFLICT (job_id, attempt_number) DO NOTHING`,
        [job.id, job.attempt_count, workerInstanceId, job.lease_generation, nowIso],
      );
    }

    if (failureInjector?.afterLeaseClaim) {
      await failureInjector.afterLeaseClaim(rows);
    }

    await client.query('COMMIT');
    return { jobs: rows, blocked: false, snap };
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

export async function markJobRunning(pool, job, workerInstanceId) {
  const { rowCount } = await pool.query(
    `UPDATE workflow.jobs
     SET status = 'RUNNING', updated_at = now()
     WHERE id = $1
       AND lease_owner = $2
       AND lease_generation = $3
       AND status = 'LEASED'
       AND lease_expires_at > now()`,
    [job.id, workerInstanceId, job.lease_generation],
  );
  return rowCount === 1;
}

export async function renewLease(pool, job, workerInstanceId, leaseMs = RuntimeLimits.LEASE_MS) {
  const { rowCount } = await pool.query(
    `UPDATE workflow.jobs
     SET lease_expires_at = now() + ($4::text || ' milliseconds')::interval,
         updated_at = now()
     WHERE id = $1
       AND lease_owner = $2
       AND lease_generation = $3
       AND status IN ('LEASED','RUNNING')
       AND lease_expires_at > now()`,
    [job.id, workerInstanceId, job.lease_generation, String(leaseMs)],
  );
  return rowCount === 1;
}

export { JobStatus };
