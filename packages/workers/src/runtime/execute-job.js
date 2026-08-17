/**
 * Execute one leased job through capability registry + control gates.
 */
import {
  WorkflowErrorClass,
  KillDomain,
  evaluateWorkerMayProcess,
  KillState,
  PersistenceAdapterKind,
  ExternalEffectAdapterKind,
  SYNTHETIC_NOOP_EVENT_TYPE,
} from '@deintarifheld/shared';
import {
  markJobRunning,
  renewLease,
  completeJobSuccess,
  scheduleRetryOrDeadLetter,
  failPermanent,
  evaluatePreEffectControl,
} from '@deintarifheld/db';
import { resolveCapabilityOrFail } from './capability-registry.js';
import { createDenyAllEffectAdapter } from '../deny-effects.js';

export function createIdempotentEffectTracker() {
  const map = new Map();
  return {
    record(jobId, op) {
      const prev = map.get(jobId) || [];
      if (!prev.includes(op)) prev.push(op);
      map.set(jobId, prev);
    },
    count(jobId) {
      return (map.get(jobId) || []).length;
    },
    snapshot() {
      return Object.fromEntries(map.entries());
    },
  };
}

export async function executeLeasedJob(pool, job, {
  emailProvider = null,
  calendarProvider = null,
  workerInstanceId,
  effectAdapter = createDenyAllEffectAdapter(),
  idempotentEffects,
  failureInjector = null,
  random = Math.random,
  activationConfig = {},
} = {}) {
  const logBase = {
    correlation_id: job.correlation_id,
    workflow_id: job.workflow_instance_id,
    job_id: job.id,
    job_type: job.job_type,
    worker_id: workerInstanceId,
    attempt: job.attempt_count,
  };

  if (failureInjector?.beforeHandler) {
    await failureInjector.beforeHandler(job);
  }

  const gate = evaluateWorkerMayProcess({
    runtimeEnvironment: activationConfig.runtimeEnvironment ?? 'TEST',
    localTestFlag: activationConfig.localTestFlag ?? true,
    automationActivation: activationConfig.automationActivation ?? true,
    automationEngineKillState: activationConfig.automationEngineKillState ?? KillState.INACTIVE,
    persistenceAdapter:
      activationConfig.persistenceAdapter ?? PersistenceAdapterKind.DISPOSABLE_LOCAL_DATABASE,
    eventType: activationConfig.eventType ?? SYNTHETIC_NOOP_EVENT_TYPE,
    externalEffectAdapter:
      activationConfig.externalEffectAdapter ?? ExternalEffectAdapterKind.DENY_ALL,
  });
  if (!gate.mayProcess) {
    return failPermanent(pool, job, {
      workerInstanceId,
      errorClass: WorkflowErrorClass.AUTHORIZATION_DENIED,
      errorCode: gate.reasons[0] || 'ACTIVATION_DENIED',
    });
  }

  const running = await markJobRunning(pool, job, workerInstanceId);
  if (!running) {
    return { ok: false, code: 'STALE_LEASE', stale: true };
  }

  const resolved = resolveCapabilityOrFail(job.job_type);
  if (!resolved.ok) {
    return failPermanent(pool, job, {
      workerInstanceId,
      errorClass: resolved.errorClass,
      errorCode: resolved.errorCode,
    });
  }

  let handlerResult;
  try {
    handlerResult = await resolved.handler(job, {
      pool,
      effectAdapter,
      idempotentEffects,
      emailProvider,
      calendarProvider,
      renewLease: () => renewLease(pool, job, workerInstanceId),
      preEffectControlCheck: () =>
        evaluatePreEffectControl(pool, {
          ...job,
          control_domain: KillDomain.AUTOMATION_ENGINE,
        }),
      failureInjector,
    });
  } catch (err) {
    // Poison / unexpected: isolate job, do not crash loop
    handlerResult = {
      ok: false,
      errorClass: WorkflowErrorClass.HANDLER_BUG,
      errorCode: 'HANDLER_THREW',
      permanent: true,
      detail: String(err?.message || err).slice(0, 200),
    };
  }

  if (failureInjector?.afterHandlerBeforeCompletion) {
    await failureInjector.afterHandlerBeforeCompletion(job, handlerResult);
  }

  if (handlerResult?.ok) {
    // Fresh control before any terminal success that may have intended effects
    const pre = await evaluatePreEffectControl(pool, {
      ...job,
      control_domain: KillDomain.AUTOMATION_ENGINE,
    });
    if (!pre.allowed) {
      return failPermanent(pool, job, {
        workerInstanceId,
        errorClass: WorkflowErrorClass.CONTROL_BLOCKED,
        errorCode: pre.code,
      });
    }

    return completeJobSuccess(pool, job, {
      workerInstanceId,
      nextJob: handlerResult.next || null,
      completeWorkflow: Boolean(handlerResult.completeWorkflow),
      workflowState: handlerResult.workflowState || 'COMPLETED',
      failureInjector,
    });
  }

  const errorClass = handlerResult?.errorClass || WorkflowErrorClass.HANDLER_BUG;
  const errorCode = handlerResult?.errorCode || 'HANDLER_FAILED';

  if (handlerResult?.permanent) {
    return failPermanent(pool, job, { workerInstanceId, errorClass, errorCode });
  }

  return scheduleRetryOrDeadLetter(pool, job, {
    workerInstanceId,
    errorClass,
    errorCode,
    random,
    failureInjector,
  });
}

export function structuredLog(level, msg, fields) {
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : 'log'](
    JSON.stringify({ level, msg, ...fields, ts: new Date().toISOString() }),
  );
}
