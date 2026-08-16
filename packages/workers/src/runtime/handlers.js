/**
 * Synthetic A1 handlers only — no mail, calendar, AI, CRM, providers.
 */
import { SyntheticCapability, WorkflowErrorClass } from '@deintarifheld/shared';
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

export function registerAllSyntheticHandlers() {
  installDefaultSyntheticCapabilities({
    [SyntheticCapability.SYNTHETIC_NOOP]: handleSyntheticNoop,
    [SyntheticCapability.SYNTHETIC_TRANSIENT_FAIL_THEN_SUCCESS]: handleTransientFailThenSuccess,
    [SyntheticCapability.SYNTHETIC_PERMANENT_FAIL]: handlePermanentFail,
    [SyntheticCapability.SYNTHETIC_LONG_RUNNING]: handleLongRunning,
    [SyntheticCapability.SYNTHETIC_EFFECT_INTENT_DENIED]: handleEffectIntentDenied,
    [SyntheticCapability.SYNTHETIC_CHAIN_STEP]: handleChainStep,
    [SyntheticCapability.SYNTHETIC_POISON]: handlePoison,
  });
}
