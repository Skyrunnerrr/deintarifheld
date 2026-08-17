/**
 * Synthetic A1 handlers only — no mail, calendar, AI, CRM, providers.
 */
import {
  SyntheticCapability,
  WorkflowErrorClass,
  B2B_QUALIFICATION_START_CAPABILITY,
  B2B_QUALIFICATION_REEVALUATE_CAPABILITY,
  B2B_MISSING_INFO_COMMUNICATE_CAPABILITY,
  B2B_COMMUNICATION_SEND_CAPABILITY,
  B2B_MISSING_INFO_FOLLOWUP_CAPABILITY,
  B2B_INBOUND_EMAIL_PROCESS_CAPABILITY,
  B2B_APPOINTMENT_OFFER_PREPARE_CAPABILITY,
  QualificationOutcome,
} from '@deintarifheld/shared';
import { installDefaultSyntheticCapabilities } from './capability-registry.js';

/** In-memory attempt counters for transient-then-success (per job id). LOCAL_TEST_ONLY */
const transientHits = new Map();

export function resetSyntheticHandlerState() {
  transientHits.clear();
}

export async function handleSyntheticNoop(job, ctx) {
  if (job.payload_redacted?.__poison === true) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.POISON_PAYLOAD,
      errorCode: 'POISON_PAYLOAD',
      permanent: true,
    };
  }
  // Idempotent bookkeeping — safe under at-least-once
  ctx.idempotentEffects?.record?.(job.id, 'NOOP');
  return { ok: true, next: null, completeWorkflow: true, workflowState: 'NOOP_DONE' };
}

export async function handleTransientFailThenSuccess(job, ctx) {
  const n = (transientHits.get(job.id) || 0) + 1;
  transientHits.set(job.id, n);
  if (n === 1) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.TRANSIENT,
      errorCode: 'SYNTHETIC_TRANSIENT',
      safeRetry: true,
    };
  }
  ctx.idempotentEffects?.record?.(job.id, 'TRANSIENT_THEN_OK');
  return { ok: true, completeWorkflow: true, workflowState: 'TRANSIENT_RECOVERED' };
}

export async function handlePermanentFail() {
  return {
    ok: false,
    errorClass: WorkflowErrorClass.VALIDATION_PERMANENT,
    errorCode: 'SYNTHETIC_PERMANENT',
    permanent: true,
  };
}

export async function handleLongRunning(job, ctx) {
  const ms = Number(job.payload_redacted?.delay_ms || 50);
  if (ctx.renewLease) {
    await ctx.renewLease();
  }
  await new Promise((r) => setTimeout(r, Math.min(ms, 200)));
  ctx.idempotentEffects?.record?.(job.id, 'LONG_RUNNING');
  return { ok: true, completeWorkflow: true, workflowState: 'LONG_DONE' };
}

/**
 * Proves pre-effect control gate: attempts effect adapter only after fresh check.
 */
export async function handleEffectIntentDenied(job, ctx) {
  const gate = await ctx.preEffectControlCheck();
  if (!gate.allowed) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.CONTROL_BLOCKED,
      errorCode: gate.code,
      permanent: true,
    };
  }
  const effect = ctx.effectAdapter.sendMail({ subject: 'A1_SHOULD_DENY' });
  if (effect.ok) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.HANDLER_BUG,
      errorCode: 'EFFECT_UNEXPECTEDLY_ALLOWED',
      permanent: true,
    };
  }
  ctx.idempotentEffects?.record?.(job.id, 'EFFECT_DENIED');
  return { ok: true, completeWorkflow: true, workflowState: 'EFFECT_DENIED_OK' };
}

export async function handleChainStep(job, ctx) {
  const step = Number(job.payload_redacted?.step || 1);
  ctx.idempotentEffects?.record?.(job.id, `CHAIN_${step}`);
  if (step >= 2) {
    return { ok: true, completeWorkflow: true, workflowState: 'CHAIN_DONE' };
  }
  return {
    ok: true,
    next: {
      jobType: SyntheticCapability.SYNTHETIC_CHAIN_STEP,
      idempotencyKey: `${job.idempotency_key}:step:${step + 1}`,
      payloadRedacted: { step: step + 1 },
    },
    completeWorkflow: false,
  };
}

export async function handlePoison() {
  return {
    ok: false,
    errorClass: WorkflowErrorClass.POISON_PAYLOAD,
    errorCode: 'POISON_HANDLER',
    permanent: true,
  };
}

/**
 * A3: deterministic B2B CALL_READY qualification.
 * A1 synthetic harness cases are not in public.cases — success no-op preserves A1.
 */

async function enqueueMissingInfoCommunicate(pool, caseId, leadId, revision = 'current') {
  if (!pool || !caseId) return null;
  try {
    const { rows: wfs } = await pool.query(
      `SELECT id, correlation_id, control_version_at_start FROM workflow.workflow_instances
       WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [caseId],
    );
    const wf = wfs[0];
    if (!wf) return null;
    const idem = `b2b-missing-comm:${caseId}:${revision}:${leadId || 'na'}`;
    const ins = await pool.query(
      `INSERT INTO workflow.jobs
        (workflow_instance_id, job_type, status, priority, max_attempts,
         idempotency_key, correlation_id, control_version, payload_redacted)
       VALUES ($1,$2,'READY',85,5,$3,$4,$5,$6::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [
        wf.id,
        B2B_MISSING_INFO_COMMUNICATE_CAPABILITY,
        idem,
        wf.correlation_id,
        wf.control_version_at_start || 1,
        JSON.stringify({ case_id: String(caseId), lead_id: leadId ? String(leadId) : null, schema_version: 1 }),
      ],
    );
    return ins.rows[0]?.id || null;
  } catch {
    // A4 enqueue must never fail A3 qualification authority.
    return null;
  }
}

export async function handleB2bQualificationStart(job, ctx) {
  const caseId = String(job.payload_redacted?.case_id || '');
  const leadId = String(job.payload_redacted?.lead_id || '');
  if (!caseId || !leadId) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.VALIDATION_PERMANENT,
      errorCode: 'QUAL_START_PAYLOAD_INCOMPLETE',
      permanent: true,
    };
  }
  if (!ctx?.pool) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.HANDLER_BUG,
      errorCode: 'POOL_REQUIRED',
      permanent: true,
    };
  }

  const exists = await ctx.pool.query(
    `SELECT 1 AS ok FROM public.cases WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [caseId],
  );
  if (exists.rowCount === 0) {
    ctx.idempotentEffects?.record?.(job.id, 'B2B_QUALIFICATION_START_SYNTHETIC');
    return {
      ok: true,
      completeWorkflow: false,
      workflowState: 'QUALIFICATION_PENDING',
    };
  }

  try {
    ctx.failureInjector?.('a3_pre_eval');
    const { evaluateQualification } = await import('@deintarifheld/db');
    const result = await evaluateQualification(ctx.pool, {
      caseId,
      trigger: 'START',
      failureInjector: ctx.failureInjector,
    });
    ctx.failureInjector?.('a3_post_commit');
    ctx.idempotentEffects?.record?.(job.id, `B2B_QUALIFICATION_START:${result.outcome}`);
    if (result.outcome === QualificationOutcome.MISSING_INFORMATION) {
      await enqueueMissingInfoCommunicate(ctx.pool, caseId, leadId, result.revision);
    }
    return {
      ok: true,
      completeWorkflow: false,
      workflowState: result.workflowState,
    };
  } catch (err) {
    if (err?.code === 'PURPOSE_BOUNDARY' || err?.permanent) {
      return {
        ok: false,
        errorClass: WorkflowErrorClass.VALIDATION_PERMANENT,
        errorCode: err.code || 'QUALIFICATION_PERMANENT',
        permanent: true,
      };
    }
    throw err;
  }
}

export async function handleB2bQualificationReevaluate(job, ctx) {
  const caseId = String(job.payload_redacted?.case_id || '');
  if (!caseId) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.VALIDATION_PERMANENT,
      errorCode: 'CASE_ID_REQUIRED',
      permanent: true,
    };
  }
  if (!ctx?.pool) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.HANDLER_BUG,
      errorCode: 'POOL_REQUIRED',
      permanent: true,
    };
  }
  const exists = await ctx.pool.query(
    `SELECT 1 AS ok FROM public.cases WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [caseId],
  );
  if (exists.rowCount === 0) {
    return { ok: true, completeWorkflow: false, workflowState: 'QUALIFICATION_PENDING' };
  }
  const { evaluateQualification } = await import('@deintarifheld/db');
  const result = await evaluateQualification(ctx.pool, {
    caseId,
    trigger: 'REEVALUATE',
    failureInjector: ctx.failureInjector,
  });
  ctx.idempotentEffects?.record?.(job.id, `B2B_QUALIFICATION_REEVALUATE:${result.outcome}`);
  try {
    const { cancelStaleOutboundIntents, cancelFollowupsForConversation } = await import('@deintarifheld/db');
    await cancelStaleOutboundIntents(ctx.pool, caseId, { currentRevision: result.revision });
    if (result.outcome === QualificationOutcome.QUALIFIED_FOR_CALL) {
      const { rows: convs } = await ctx.pool.query(
        `SELECT id FROM ops.conversations WHERE case_id = $1`,
        [caseId],
      );
      for (const conv of convs) {
        await cancelFollowupsForConversation(ctx.pool, conv.id, 'CANCELLED_QUALIFIED');
      }
    }
  } catch {
    /* A4 tables/ops may be absent in older fixtures — qualification still stands */
  }
  if (result.outcome === QualificationOutcome.MISSING_INFORMATION) {
    await enqueueMissingInfoCommunicate(ctx.pool, caseId, job.payload_redacted?.lead_id, result.revision);
  }
  return {
    ok: true,
    completeWorkflow: false,
    workflowState: result.workflowState,
  };
}

export async function handleB2bMissingInfoCommunicate(job, ctx) {
  const caseId = String(job.payload_redacted?.case_id || '');
  if (!caseId || !ctx?.pool) {
    return { ok: false, errorClass: WorkflowErrorClass.VALIDATION_PERMANENT, errorCode: 'CASE_ID_REQUIRED', permanent: true };
  }
  try {
    const { prepareMissingInfoCommunication } = await import('@deintarifheld/db');
    const prep = await prepareMissingInfoCommunication(ctx.pool, { caseId });
    if (!prep.ok && (prep.code === 'NOT_MISSING_INFORMATION' || prep.code === 'NO_OPEN_REQUIREMENTS' || prep.code === 'SUPPRESSED')) {
      return { ok: true, completeWorkflow: false, workflowState: 'COMMUNICATION_SKIPPED' };
    }
    if (!prep.ok) {
      return { ok: true, completeWorkflow: false, workflowState: `COMMUNICATION_SKIPPED:${prep.code}` };
    }
    return { ok: true, completeWorkflow: false, workflowState: 'COMMUNICATION_INTENT_READY' };
  } catch {
    return { ok: true, completeWorkflow: false, workflowState: 'COMMUNICATION_PREPARE_DEFERRED' };
  }
}

export async function handleB2bCommunicationSend(job, ctx) {
  const intentId = String(job.payload_redacted?.intent_id || '');
  if (!intentId || !ctx?.pool) {
    return { ok: false, errorClass: WorkflowErrorClass.VALIDATION_PERMANENT, errorCode: 'INTENT_ID_REQUIRED', permanent: true };
  }
  if (ctx.preEffectControlCheck) {
    const gate = await ctx.preEffectControlCheck();
    if (!gate.allowed) {
      return { ok: false, errorClass: WorkflowErrorClass.CONTROL_BLOCKED, errorCode: gate.code, permanent: true };
    }
  }
  const { executeCommunicationSend, createMockEmailProvider } = await import('@deintarifheld/db');
  const result = await executeCommunicationSend(ctx.pool, {
    intentId,
    emailProvider: ctx.emailProvider || createMockEmailProvider(),
  });
  if (result.cancelled) {
    return { ok: true, completeWorkflow: false, workflowState: 'COMMUNICATION_CANCELLED_STALE' };
  }
  if (result.outcomeUnknown || result.alreadyTerminal) {
    return { ok: true, completeWorkflow: false, workflowState: 'COMMUNICATION_RECONCILIATION_REQUIRED' };
  }
  if (result.deferred || result.code === 'CONTROL_UNAVAILABLE') {
    return { ok: false, errorClass: WorkflowErrorClass.CONTROL_BLOCKED, errorCode: 'CONTROL_UNAVAILABLE', permanent: false };
  }
  if (!result.ok && !result.providerAccepted) {
    const permanent = result.code === 'MOCK_FAIL' || result.code === 'PERMANENT_FAILURE';
    return {
      ok: false,
      errorClass: permanent ? WorkflowErrorClass.VALIDATION_PERMANENT : WorkflowErrorClass.TRANSIENT,
      errorCode: result.code || 'SEND_FAILED',
      permanent,
    };
  }
  return { ok: true, completeWorkflow: false, workflowState: 'WAITING_CUSTOMER_RESPONSE' };
}

export async function handleB2bMissingInfoFollowup(job, ctx) {
  const caseId = String(job.payload_redacted?.case_id || '');
  const conversationId = String(job.payload_redacted?.conversation_id || '');
  const generation = Number(job.payload_redacted?.generation || 1);
  if (!caseId || !conversationId || !ctx?.pool) {
    return { ok: false, errorClass: WorkflowErrorClass.VALIDATION_PERMANENT, errorCode: 'FOLLOWUP_ARGS', permanent: true };
  }
  if (ctx.preEffectControlCheck) {
    const gate = await ctx.preEffectControlCheck();
    if (!gate.allowed) {
      return { ok: false, errorClass: WorkflowErrorClass.CONTROL_BLOCKED, errorCode: gate.code, permanent: true };
    }
  }
  const { executeFollowupDue, createMockEmailProvider } = await import('@deintarifheld/db');
  const result = await executeFollowupDue(ctx.pool, {
    caseId,
    conversationId,
    generation,
    emailProvider: ctx.emailProvider || createMockEmailProvider(),
  });
  return { ok: true, completeWorkflow: false, workflowState: result.cancelled ? 'FOLLOWUP_CANCELLED' : 'FOLLOWUP_DONE' };
}

export async function handleB2bInboundEmailProcess(job, ctx) {
  const inboundEventId = String(job.payload_redacted?.inbound_event_id || '');
  if (!inboundEventId || !ctx?.pool) {
    return { ok: false, errorClass: WorkflowErrorClass.VALIDATION_PERMANENT, errorCode: 'INBOUND_ID_REQUIRED', permanent: true };
  }
  const { processInboundEvent, createMockEmailProvider } = await import('@deintarifheld/db');
  const result = await processInboundEvent(ctx.pool, {
    inboundEventId,
    emailProvider: ctx.emailProvider || createMockEmailProvider(),
  });
  if (result.retry) {
    return { ok: false, errorClass: WorkflowErrorClass.TRANSIENT, errorCode: result.code, permanent: false };
  }
  return { ok: true, completeWorkflow: false, workflowState: result.outcome || 'INBOUND_PROCESSED' };
}

export async function handleAppointmentOfferPrepare(job, ctx) {
  ctx.idempotentEffects?.record?.(job.id, 'APPOINTMENT_OFFER_PREPARE_READY');
  return { ok: true, completeWorkflow: false, workflowState: 'QUALIFIED_FOR_CALL' };
}

export function registerAllSyntheticHandlers() {
  installDefaultSyntheticCapabilities({
    [SyntheticCapability.SYNTHETIC_NOOP]: handleSyntheticNoop,
    [SyntheticCapability.SYNTHETIC_TRANSIENT_FAIL_THEN_SUCCESS]: handleTransientFailThenSuccess,
    [SyntheticCapability.SYNTHETIC_PERMANENT_FAIL]: handlePermanentFail,
    [SyntheticCapability.SYNTHETIC_LONG_RUNNING]: handleLongRunning,
    [SyntheticCapability.SYNTHETIC_EFFECT_INTENT_DENIED]: handleEffectIntentDenied,
    [SyntheticCapability.SYNTHETIC_CHAIN_STEP]: handleChainStep,
    [SyntheticCapability.SYNTHETIC_POISON]: handlePoison,
    [B2B_QUALIFICATION_START_CAPABILITY]: handleB2bQualificationStart,
    [B2B_QUALIFICATION_REEVALUATE_CAPABILITY]: handleB2bQualificationReevaluate,
    [B2B_MISSING_INFO_COMMUNICATE_CAPABILITY]: handleB2bMissingInfoCommunicate,
    [B2B_COMMUNICATION_SEND_CAPABILITY]: handleB2bCommunicationSend,
    [B2B_MISSING_INFO_FOLLOWUP_CAPABILITY]: handleB2bMissingInfoFollowup,
    [B2B_INBOUND_EMAIL_PROCESS_CAPABILITY]: handleB2bInboundEmailProcess,
    [B2B_APPOINTMENT_OFFER_PREPARE_CAPABILITY]: handleAppointmentOfferPrepare,
  });
}
