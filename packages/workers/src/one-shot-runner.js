/**
 * P3-F5 one-shot local worker stub — no loop, no scheduler, no retry engine.
 */
import {
  evaluateWorkerMayProcess,
  SYNTHETIC_NOOP_EVENT_TYPE,
  WorkerRunResultCode,
  WorkerErrorClass,
  MAX_JOBS_PER_TEST_RUN,
  KillState,
  PersistenceAdapterKind,
  ExternalEffectAdapterKind,
} from '@deintarifheld/shared';
import {
  claimOneSyntheticNoop,
  markOutboxProcessed,
  markOutboxFailed,
} from '@deintarifheld/db';
import { createDenyAllEffectAdapter } from './deny-effects.js';
import { runSyntheticNoopHandler } from './noop-handler.js';

/**
 * @param {object} opts
 * @param {import('pg').Pool} opts.pool
 * @param {object} opts.config injected test configuration only
 */
export async function runOneShotLocalWorker({
  pool,
  config = {},
  effectAdapter = createDenyAllEffectAdapter(),
  claimFn = claimOneSyntheticNoop,
  markProcessedFn = markOutboxProcessed,
  markFailedFn = markOutboxFailed,
  handler = runSyntheticNoopHandler,
} = {}) {
  const gate = evaluateWorkerMayProcess({
    runtimeEnvironment: config.runtimeEnvironment,
    localTestFlag: config.localTestFlag,
    automationActivation: config.automationActivation,
    automationEngineKillState: config.automationEngineKillState ?? KillState.ACTIVE,
    persistenceAdapter:
      config.persistenceAdapter ?? PersistenceAdapterKind.DISPOSABLE_LOCAL_DATABASE,
    eventType: config.eventType ?? SYNTHETIC_NOOP_EVENT_TYPE,
    externalEffectAdapter:
      config.externalEffectAdapter ?? ExternalEffectAdapterKind.DENY_ALL,
  });

  if (!gate.mayProcess) {
    let code = WorkerRunResultCode.BLOCKED_ACTIVATION;
    if (gate.reasons.includes('AUTOMATION_ENGINE_KILL_ACTIVE')) {
      code = WorkerRunResultCode.BLOCKED_KILL;
    } else if (gate.reasons.includes('LOCAL_TEST_FLAG_REQUIRED')) {
      code = WorkerRunResultCode.BLOCKED_TEST_FLAG;
    }
    return {
      ok: true,
      code,
      jobsProcessed: 0,
      rowsClaimed: 0,
      rowsMutated: 0,
      handlersCalled: 0,
      outboxRowsCreatedByWorker: 0,
      outboxRowsUpdatedByWorker: 0,
      gate,
      CONTINUOUS_LOOP_IMPLEMENTED: 'NO',
      SCHEDULER_IMPLEMENTED: 'NO',
      AUTOMATIC_RETRY_IMPLEMENTED: 'NO',
      DEAD_LETTER_IMPLEMENTED: 'NO',
      MAX_JOBS_PER_TEST_RUN,
      externalAttempts: effectAdapter.getAttempts?.() || {},
    };
  }

  let claimed;
  try {
    claimed = await claimFn(pool, { eventType: SYNTHETIC_NOOP_EVENT_TYPE });
  } catch (err) {
    return {
      ok: false,
      code: WorkerRunResultCode.CLAIM_FAILED,
      errorClass: WorkerErrorClass.CLAIM_ERROR,
      jobsProcessed: 0,
      rowsClaimed: 0,
      rowsMutated: 0,
      handlersCalled: 0,
      outboxRowsCreatedByWorker: 0,
      outboxRowsUpdatedByWorker: 0,
      detail: String(err?.message || err),
      gate,
    };
  }

  if (!claimed) {
    return {
      ok: true,
      code: WorkerRunResultCode.NO_ELIGIBLE_JOB,
      jobsProcessed: 0,
      rowsClaimed: 0,
      rowsMutated: 0,
      handlersCalled: 0,
      outboxRowsCreatedByWorker: 0,
      outboxRowsUpdatedByWorker: 0,
      gate,
      MAX_JOBS_PER_TEST_RUN,
    };
  }

  // Exactly one job per run — process then exit (no loop).
  const handlerResult = await handler(claimed, { effectAdapter });
  if (!handlerResult?.ok) {
    await markFailedFn(pool, claimed.id, WorkerErrorClass.HANDLER_ERROR);
    return {
      ok: false,
      code: WorkerRunResultCode.HANDLER_FAILED,
      errorClass: WorkerErrorClass.HANDLER_ERROR,
      jobsProcessed: 0,
      rowsClaimed: 1,
      rowsMutated: 1,
      handlersCalled: 1,
      outboxRowsCreatedByWorker: 0,
      outboxRowsUpdatedByWorker: 1,
      claimedId: claimed.id,
      gate,
      MAX_JOBS_PER_TEST_RUN,
    };
  }

  await markProcessedFn(pool, claimed.id);
  return {
    ok: true,
    code: WorkerRunResultCode.PROCESSED_ONE,
    jobsProcessed: 1,
    rowsClaimed: 1,
    rowsMutated: 1,
    handlersCalled: 1,
    outboxRowsCreatedByWorker: 0,
    outboxRowsUpdatedByWorker: 1,
    claimedId: claimed.id,
    gate,
    CONTINUOUS_LOOP_IMPLEMENTED: 'NO',
    SCHEDULER_IMPLEMENTED: 'NO',
    CRON_IMPLEMENTED: 'NO',
    AUTOMATIC_RETRY_IMPLEMENTED: 'NO',
    DEAD_LETTER_IMPLEMENTED: 'NO',
    REPROCESS_IMPLEMENTED: 'NO',
    MAX_JOBS_PER_TEST_RUN,
    PRODUCTION_EXACTLY_ONCE_GUARANTEE: 'NO',
    externalAttempts: effectAdapter.getAttempts?.() || {},
  };
}
