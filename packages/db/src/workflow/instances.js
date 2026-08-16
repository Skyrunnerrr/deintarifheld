/**
 * Workflow instance + job creation (idempotent).
 */
import {
  A1_WORKFLOW_TYPE,
  A1_WORKFLOW_VERSION,
  JobStatus,
  WorkflowStatus,
  RuntimeLimits,
} from '@deintarifheld/shared';
import { readControlVersion } from './control.js';

function assertPayloadBounded(payload) {
  const json = JSON.stringify(payload ?? {});
  if (Buffer.byteLength(json, 'utf8') > RuntimeLimits.MAX_PAYLOAD_BYTES) {
    const err = new Error('PAYLOAD_TOO_LARGE');
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }
  return JSON.parse(json);
}

/**
 * Idempotent workflow start + initial job.
 * Unique on (workflow_type, aggregate_type, aggregate_id, correlation_id).
 */
export async function startWorkflowIdempotent(pool, {
  workflowType = A1_WORKFLOW_TYPE,
  workflowVersion = A1_WORKFLOW_VERSION,
  aggregateType,
  aggregateId,
  caseId = null,
  correlationId,
  currentState = 'STARTED',
  jobType,
  jobIdempotencyKey,
  priority = 100,
  scheduledAt = null,
  maxAttempts = RuntimeLimits.MAX_ATTEMPTS_DEFAULT,
  payloadRedacted = {},
  metadataRedacted = {},
} = {}) {
  if (!aggregateType || !aggregateId || !correlationId || !jobType || !jobIdempotencyKey) {
    throw new Error('WORKFLOW_START_ARGS_REQUIRED');
  }
  const payload = assertPayloadBounded(payloadRedacted);
  const metadata = assertPayloadBounded(metadataRedacted);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const controlVersion = await readControlVersion(client);

    const existing = await client.query(
      `SELECT id, status FROM workflow.workflow_instances
       WHERE workflow_type = $1 AND aggregate_type = $2
         AND aggregate_id = $3 AND correlation_id = $4`,
      [workflowType, aggregateType, aggregateId, correlationId],
    );

    let workflowId;
    let created = false;
    if (existing.rows[0]) {
      workflowId = existing.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO workflow.workflow_instances
          (workflow_type, workflow_version, aggregate_type, aggregate_id, case_id,
           status, current_state, correlation_id, control_version_at_start, metadata_redacted)
         VALUES ($1,$2,$3,$4,$5,'RUNNING',$6,$7,$8,$9::jsonb)
         RETURNING id`,
        [
          workflowType,
          workflowVersion,
          aggregateType,
          aggregateId,
          caseId,
          currentState,
          correlationId,
          controlVersion,
          JSON.stringify(metadata),
        ],
      );
      workflowId = ins.rows[0].id;
      created = true;
    }

    const jobExisting = await client.query(
      `SELECT id, status FROM workflow.jobs WHERE idempotency_key = $1`,
      [jobIdempotencyKey],
    );
    let jobId;
    let jobCreated = false;
    if (jobExisting.rows[0]) {
      jobId = jobExisting.rows[0].id;
    } else {
      const j = await client.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, scheduled_at,
           max_attempts, idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now()),$6,$7,$8,$9,$10::jsonb)
         RETURNING id`,
        [
          workflowId,
          jobType,
          JobStatus.READY,
          priority,
          scheduledAt,
          maxAttempts,
          jobIdempotencyKey,
          correlationId,
          controlVersion,
          JSON.stringify(payload),
        ],
      );
      jobId = j.rows[0].id;
      jobCreated = true;
    }

    await client.query('COMMIT');
    return {
      workflowId,
      jobId,
      created,
      jobCreated,
      duplicate: !created && !jobCreated,
      controlVersion,
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

/**
 * A2 handoff surface: enqueue LEAD_ACCEPTED → B2B inbound workflow + qualification start job.
 * Idempotent by lead + correlation. Prefer reconcileLeadToCaseHandoff for full Case+Workflow lineage.
 */
export async function enqueueLeadAcceptedWorkflowStart(pool, {
  leadId,
  correlationId,
  caseId = null,
  scheduledAt = null,
} = {}) {
  return startWorkflowIdempotent(pool, {
    workflowType: 'B2B_INBOUND_CUSTOMER',
    workflowVersion: 1,
    aggregateType: 'lead',
    aggregateId: String(leadId),
    caseId,
    correlationId,
    currentState: 'LEAD_ACCEPTED_HANDOFF',
    jobType: 'B2B_QUALIFICATION_START',
    jobIdempotencyKey: caseId
      ? `b2b-qual-start:${leadId}:${caseId}`
      : `lead-accepted:${leadId}:${correlationId}`,
    scheduledAt,
    payloadRedacted: {
      event: 'LEAD_ACCEPTED',
      lead_id: String(leadId),
      case_id: caseId ? String(caseId) : null,
      schema_version: 1,
    },
    metadataRedacted: { handoff: 'A2', implemented_business: true },
  });
}

export async function createFollowOnJob(client, {
  workflowInstanceId,
  jobType,
  idempotencyKey,
  correlationId,
  controlVersion,
  priority = 100,
  scheduledAt = null,
  maxAttempts = RuntimeLimits.MAX_ATTEMPTS_DEFAULT,
  payloadRedacted = {},
}) {
  const payload = assertPayloadBounded(payloadRedacted);
  const { rows } = await client.query(
    `INSERT INTO workflow.jobs
      (workflow_instance_id, job_type, status, priority, scheduled_at,
       max_attempts, idempotency_key, correlation_id, control_version, payload_redacted)
     VALUES ($1,$2,'READY',$3,COALESCE($4::timestamptz, now()),$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = workflow.jobs.updated_at
     RETURNING id, (xmax = 0) AS inserted`,
    [
      workflowInstanceId,
      jobType,
      priority,
      scheduledAt,
      maxAttempts,
      idempotencyKey,
      correlationId,
      controlVersion,
      JSON.stringify(payload),
    ],
  );
  return rows[0];
}

export async function completeWorkflowIfTerminal(client, workflowId, currentState = 'COMPLETED') {
  await client.query(
    `UPDATE workflow.workflow_instances
     SET status = $2, current_state = $3, completed_at = now(), updated_at = now()
     WHERE id = $1 AND status NOT IN ('COMPLETED','CANCELLED')`,
    [workflowId, WorkflowStatus.COMPLETED, currentState],
  );
}

export async function markWorkflowBlocked(client, workflowId, failureClass, failureCode) {
  await client.query(
    `UPDATE workflow.workflow_instances
     SET status = 'BLOCKED_EXCEPTION',
         failure_class = $2,
         failure_code = $3,
         updated_at = now()
     WHERE id = $1 AND status NOT IN ('COMPLETED','CANCELLED')`,
    [workflowId, failureClass, failureCode],
  );
}
