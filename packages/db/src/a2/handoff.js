/**
 * A2 Lead→Case handoff reconciliation.
 * Safe to call repeatedly. Creates only missing lineage steps.
 */
import {
  BUSINESS_LEAD_ACCEPTED_EVENT,
  BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION,
  B2B_INBOUND_WORKFLOW_TYPE,
  B2B_INBOUND_WORKFLOW_VERSION,
  B2B_QUALIFICATION_START_CAPABILITY,
  CASE_INITIAL_STATUS,
  WORKFLOW_INITIAL_STATE,
  LeadType,
  isBusinessEnergyLeadType,
  KillDomain,
} from '@deintarifheld/shared';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { startWorkflowIdempotent } from '../workflow/instances.js';
import {
  markSourceEventProcessed,
  markSourceEventFailed,
  markSourceEventPermanentFailed,
} from './source-outbox.js';

function caseTitleFromLead(lead) {
  const firma = (lead.firma || '').trim().slice(0, 80);
  const ref = lead.lead_ref || String(lead.id).slice(0, 8);
  return firma ? `B2B · ${firma}` : `B2B · ${ref}`;
}

export async function loadLeadProjection(pool, leadId) {
  const { rows } = await pool.query(
    `SELECT id, lead_ref, lead_type, page_source, status, email, firma,
            idempotency_key, created_at
     FROM public.leads
     WHERE id = $1 AND deleted_at IS NULL`,
    [leadId],
  );
  return rows[0] || null;
}

export async function findCaseBySourceLead(pool, leadId) {
  const { rows } = await pool.query(
    `SELECT * FROM public.cases
     WHERE source_lead_id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [leadId],
  );
  return rows[0] || null;
}

export async function createCaseFromLead(pool, lead, { correlationId, actor = 'SERVICE_PRINCIPAL' } = {}) {
  const caseRef = `CASE-${lead.lead_ref || lead.id}`;
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.cases
        (case_ref, status, title, summary, source_lead_id,
         created_by_actor_type, created_by_actor_id, correlation_id)
       VALUES ($1,$2,$3,$4,$5,'SERVICE_PRINCIPAL',$6,$7)
       RETURNING *`,
      [
        caseRef,
        CASE_INITIAL_STATUS,
        caseTitleFromLead(lead),
        'Autonomous handoff from business lead intake',
        lead.id,
        actor,
        correlationId,
      ],
    );
    return { case: rows[0], created: true };
  } catch (err) {
    if (err.code === '23505') {
      const existing = await findCaseBySourceLead(pool, lead.id);
      return { case: existing, created: false };
    }
    throw err;
  }
}

export async function findWorkflowForLead(pool, leadId) {
  const { rows } = await pool.query(
    `SELECT * FROM workflow.workflow_instances
     WHERE workflow_type = $1 AND aggregate_type = 'lead' AND aggregate_id = $2
     LIMIT 1`,
    [B2B_INBOUND_WORKFLOW_TYPE, String(leadId)],
  );
  return rows[0] || null;
}

export async function findInitialQualificationJob(pool, workflowId) {
  const { rows } = await pool.query(
    `SELECT * FROM workflow.jobs
     WHERE workflow_instance_id = $1 AND job_type = $2
     ORDER BY created_at ASC
     LIMIT 1`,
    [workflowId, B2B_QUALIFICATION_START_CAPABILITY],
  );
  return rows[0] || null;
}

/**
 * Completion predicate for handoff ack.
 */
export function isHandoffComplete({ caseRow, workflow, job }) {
  return Boolean(caseRow?.id && workflow?.id && job?.id);
}

/**
 * Idempotent reconcile: Case + link + Workflow + initial job.
 */
export async function reconcileLeadToCaseHandoff(pool, sourceEvent, {
  failureInjector = null,
} = {}) {
  if (!sourceEvent) {
    return { ok: false, code: 'NO_EVENT' };
  }

  if (sourceEvent.event_type !== BUSINESS_LEAD_ACCEPTED_EVENT) {
    return { ok: false, code: 'EVENT_TYPE_NOT_ALLOWED', permanent: true };
  }

  const payload = sourceEvent.payload_redacted || {};
  const schemaVersion = Number(payload.schema_version ?? BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION);
  if (schemaVersion !== BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION) {
    return { ok: false, code: 'UNKNOWN_EVENT_VERSION', permanent: true };
  }

  // Control gate: kill pauses autonomous handoff; event remains durable
  let snap;
  try {
    snap = await readFreshControlSnapshot(pool, {
      domain: KillDomain.AUTOMATION_ENGINE,
    });
  } catch (err) {
    if (err.code === 'CONTROL_STATE_UNAVAILABLE') {
      return { ok: false, code: 'CONTROL_STATE_UNAVAILABLE', retainEvent: true };
    }
    throw err;
  }
  if (snap.globalKillActive || snap.domainKillActive) {
    return { ok: false, code: 'CONTROL_BLOCKED', retainEvent: true, snap };
  }

  const leadId = sourceEvent.aggregate_id || payload.lead_id;
  if (!leadId) {
    return { ok: false, code: 'MISSING_LEAD_ID', permanent: true };
  }

  const lead = await loadLeadProjection(pool, leadId);
  if (!lead) {
    return { ok: false, code: 'SOURCE_LEAD_MISSING', permanent: true };
  }

  if (!isBusinessEnergyLeadType(lead.lead_type)) {
    return { ok: false, code: 'LEAD_TYPE_NOT_ELIGIBLE', permanent: true };
  }

  // Career / private hard boundaries
  if (lead.page_source === 'career') {
    return { ok: false, code: 'CAREER_PROHIBITED', permanent: true };
  }
  if (lead.lead_type === LeadType.PRIVATE_ENERGY) {
    return { ok: false, code: 'PRIVATE_PROHIBITED', permanent: true };
  }

  const correlationId = sourceEvent.correlation_id;

  if (failureInjector?.beforeCase) {
    await failureInjector.beforeCase();
  }

  let caseRow = await findCaseBySourceLead(pool, lead.id);
  let caseCreated = false;
  if (!caseRow) {
    const created = await createCaseFromLead(pool, lead, { correlationId });
    caseRow = created.case;
    caseCreated = created.created;
  }

  if (failureInjector?.afterCaseBeforeWorkflow) {
    await failureInjector.afterCaseBeforeWorkflow({ caseRow });
  }

  let workflow = await findWorkflowForLead(pool, lead.id);
  let workflowCreated = false;
  let job = workflow ? await findInitialQualificationJob(pool, workflow.id) : null;

  if (!workflow || !job) {
    const started = await startWorkflowIdempotent(pool, {
      workflowType: B2B_INBOUND_WORKFLOW_TYPE,
      workflowVersion: B2B_INBOUND_WORKFLOW_VERSION,
      aggregateType: 'lead',
      aggregateId: String(lead.id),
      caseId: String(caseRow.id),
      correlationId,
      currentState: WORKFLOW_INITIAL_STATE,
      jobType: B2B_QUALIFICATION_START_CAPABILITY,
      jobIdempotencyKey: `b2b-qual-start:${lead.id}:${caseRow.id}`,
      payloadRedacted: {
        case_id: String(caseRow.id),
        lead_id: String(lead.id),
        schema_version: 1,
      },
      metadataRedacted: {
        handoff: 'A2',
        implemented_business: true,
        lead_ref: lead.lead_ref,
      },
    });
    workflow = await findWorkflowForLead(pool, lead.id);
    job = await findInitialQualificationJob(pool, started.workflowId);
    workflowCreated = started.created || started.jobCreated;
  }

  if (failureInjector?.afterWorkflowBeforeAck) {
    await failureInjector.afterWorkflowBeforeAck({ caseRow, workflow, job });
  }

  if (!isHandoffComplete({ caseRow, workflow, job })) {
    return {
      ok: false,
      code: 'HANDOFF_INCOMPLETE',
      caseId: caseRow?.id || null,
      workflowId: workflow?.id || null,
      jobId: job?.id || null,
      falseSuccess: false,
    };
  }

  await pool.query(
    `INSERT INTO public.audit_events (lead_id, event_type, detail)
     VALUES ($1,'lead.handoff_completed',$2::jsonb)`,
    [
      lead.id,
      JSON.stringify({
        case_id: caseRow.id,
        workflow_id: workflow.id,
        job_id: job.id,
        correlation_id: correlationId,
        case_created: caseCreated,
        workflow_created: workflowCreated,
      }),
    ],
  );

  return {
    ok: true,
    code: 'HANDOFF_COMPLETE',
    leadId: lead.id,
    caseId: caseRow.id,
    workflowId: workflow.id,
    jobId: job.id,
    caseCreated,
    workflowCreated,
    correlationId,
  };
}

/**
 * Claim → reconcile → ack (or retain/fail).
 */
export async function processOneBusinessLeadHandoff(pool, {
  claimFn,
  failureInjector = null,
} = {}) {
  // Fail-closed control gate before claim — preserves pending source events under kill
  try {
    const { readFreshControlSnapshot } = await import('../workflow/control.js');
    const { KillDomain } = await import('@deintarifheld/shared');
    const snap = await readFreshControlSnapshot(pool, {
      domain: KillDomain.AUTOMATION_ENGINE,
    });
    if (snap.globalKillActive || snap.domainKillActive) {
      return { ok: false, code: 'CONTROL_BLOCKED', retainEvent: true, processed: false, snap };
    }
  } catch (err) {
    if (err.code === 'CONTROL_STATE_UNAVAILABLE') {
      return { ok: false, code: 'CONTROL_STATE_UNAVAILABLE', retainEvent: true, processed: false };
    }
    throw err;
  }

  const { claimOneSourceEvent } = await import('./source-outbox.js');
  const claim = claimFn || claimOneSourceEvent;
  const event = await claim(pool, { eventType: BUSINESS_LEAD_ACCEPTED_EVENT });
  if (!event) {
    return { ok: true, code: 'NO_ELIGIBLE_EVENT', processed: false };
  }

  if (failureInjector?.afterClaimBeforeCase) {
    try {
      await failureInjector.afterClaimBeforeCase(event);
    } catch (err) {
      await markSourceEventFailed(pool, event.id, 'CRASH_INJECTED', { retryDelayMs: 0 });
      throw err;
    }
  }

  const result = await reconcileLeadToCaseHandoff(pool, event, { failureInjector });

  if (result.retainEvent || result.code === 'CONTROL_BLOCKED' || result.code === 'CONTROL_STATE_UNAVAILABLE') {
    await markSourceEventFailed(pool, event.id, result.code, { retryDelayMs: 0 });
    return { ...result, eventId: event.id, processed: false };
  }

  if (!result.ok && result.permanent) {
    await markSourceEventPermanentFailed(pool, event.id, result.code);
    return { ...result, eventId: event.id, processed: false };
  }

  if (!result.ok) {
    await markSourceEventFailed(pool, event.id, result.code || 'HANDOFF_RETRY', { retryDelayMs: 0 });
    return { ...result, eventId: event.id, processed: false };
  }

  if (failureInjector?.beforeAck) {
    try {
      await failureInjector.beforeAck(result);
    } catch (err) {
      await markSourceEventFailed(pool, event.id, 'ACK_CRASH', { retryDelayMs: 0 });
      throw err;
    }
  }

  const acked = await markSourceEventProcessed(pool, event.id);
  return {
    ...result,
    eventId: event.id,
    processed: acked,
    acked,
  };
}

export async function detectHandoffOrphans(pool) {
  const { rows: eventsWithoutCase } = await pool.query(
    `SELECT o.id
     FROM public.transactional_outbox o
     WHERE o.event_type = $1
       AND o.status IN ('pending','processing','processed')
       AND NOT EXISTS (
         SELECT 1 FROM public.cases c
         WHERE c.source_lead_id::text = o.aggregate_id
           AND c.deleted_at IS NULL
       )`,
    [BUSINESS_LEAD_ACCEPTED_EVENT],
  );

  const { rows: multiCases } = await pool.query(
    `SELECT source_lead_id, count(*)::int AS n
     FROM public.cases
     WHERE source_lead_id IS NOT NULL AND deleted_at IS NULL
     GROUP BY source_lead_id
     HAVING count(*) > 1`,
  );

  const { rows: multiWf } = await pool.query(
    `SELECT aggregate_id, count(*)::int AS n
     FROM workflow.workflow_instances
     WHERE workflow_type = $1 AND aggregate_type = 'lead'
     GROUP BY aggregate_id
     HAVING count(*) > 1`,
    [B2B_INBOUND_WORKFLOW_TYPE],
  );

  return {
    source_events_without_case: eventsWithoutCase.length,
    duplicate_cases_per_lead: multiCases.length,
    duplicate_workflows_per_lead: multiWf.length,
  };
}
