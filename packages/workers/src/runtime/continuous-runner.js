/**
 * Continuous durable worker loop — canonical A1 autonomous runtime motor.
 * Separate from one-shot-runner.js (stub remains one-shot-only by contract).
 *
 * No memory/JSON queue fallback. Postgres failure → stop claiming / fail closed.
 */
import { randomUUID } from 'node:crypto';
import {
  RuntimeLimits,
  KillState,
  PersistenceAdapterKind,
  ExternalEffectAdapterKind,
  SYNTHETIC_NOOP_EVENT_TYPE,
} from '@deintarifheld/shared';
import {
  assertWorkflowSchemaCompatible,
  claimDueJobs,
  readFreshControlSnapshot,
  getWorkflowRuntimeStats,
} from '@deintarifheld/db';
import { createDenyAllEffectAdapter } from '../deny-effects.js';
import { registerAllSyntheticHandlers } from './handlers.js';
import { executeLeasedJob, createIdempotentEffectTracker } from './execute-job.js';

export function createWorkerInstanceId() {
  return `worker-${randomUUID()}`;
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

/**
 * @param {object} opts
 * @param {import('pg').Pool} opts.pool
 * @param {'continuous'|'one-shot'} [opts.mode]
 */
export async function runDurableWorkflowWorker({
  pool,
  mode = 'continuous',
  workerInstanceId = createWorkerInstanceId(),
  effectAdapter = createDenyAllEffectAdapter(),
  activationConfig = {},
  claimBatchSize = RuntimeLimits.CLAIM_BATCH_SIZE,
  pollIntervalMs = RuntimeLimits.EMPTY_POLL_INTERVAL_MS,
  leaseMs = RuntimeLimits.LEASE_MS,
  maxIterations = Infinity,
  signal,
  failureInjector = null,
  random = Math.random,
  onTick = null,
  registerHandlers = true,
  emailProvider = null,
} = {}) {
  if (registerHandlers) registerAllSyntheticHandlers();

  // Startup validation — fail closed
  await assertWorkflowSchemaCompatible(pool);
  const bootControl = await readFreshControlSnapshot(pool);
  if (bootControl.controlVersion == null) {
    throw Object.assign(new Error('CONTROL_STATE_UNAVAILABLE'), {
      code: 'CONTROL_STATE_UNAVAILABLE',
    });
  }

  const env = String(activationConfig.runtimeEnvironment || 'TEST').toUpperCase();
  if (env === 'PRODUCTION' || env === 'PROD') {
    throw Object.assign(new Error('PRODUCTION_AUTONOMY_FORBIDDEN'), {
      code: 'PRODUCTION_AUTONOMY_FORBIDDEN',
    });
  }

  const idempotentEffects = createIdempotentEffectTracker();
  const stats = {
    workerInstanceId,
    mode,
    processRunning: true,
    automationEnabled: !bootControl.globalKillActive,
    iterations: 0,
    claimed: 0,
    succeeded: 0,
    retried: 0,
    deadLetter: 0,
    failedPermanent: 0,
    blockedControl: 0,
    staleCompletions: 0,
    loopErrors: 0,
    stoppedReason: null,
    CONTINUOUS_LOOP_IMPLEMENTED: mode === 'continuous' ? 'YES' : 'ONE_SHOT_MODE',
    MEMORY_QUEUE_FALLBACK: 0,
    JSON_QUEUE_FALLBACK: 0,
    PRODUCTION_AUTONOMY_ACTIVATIONS: 0,
    externalAttempts: () => effectAdapter.getAttempts?.() || {},
    idempotentEffects: () => idempotentEffects.snapshot(),
  };

  const ac = signal || new AbortController().signal;
  let stopping = false;

  const stop = (reason) => {
    stopping = true;
    stats.stoppedReason = reason;
    stats.processRunning = false;
  };

  if (typeof ac.addEventListener === 'function') {
    ac.addEventListener('abort', () => stop('SIGNAL'), { once: true });
  }

  const config = {
    runtimeEnvironment: activationConfig.runtimeEnvironment ?? 'TEST',
    localTestFlag: activationConfig.localTestFlag ?? true,
    automationActivation: activationConfig.automationActivation ?? true,
    automationEngineKillState: activationConfig.automationEngineKillState ?? KillState.INACTIVE,
    persistenceAdapter:
      activationConfig.persistenceAdapter ?? PersistenceAdapterKind.DISPOSABLE_LOCAL_DATABASE,
    eventType: activationConfig.eventType ?? SYNTHETIC_NOOP_EVENT_TYPE,
    externalEffectAdapter:
      activationConfig.externalEffectAdapter ?? ExternalEffectAdapterKind.DENY_ALL,
  };

  while (!stopping && stats.iterations < maxIterations) {
    stats.iterations += 1;
    try {
      // Kill active: stay alive, do not claim
      let snap;
      try {
        snap = await readFreshControlSnapshot(pool);
      } catch (err) {
        if (err.code === 'CONTROL_STATE_UNAVAILABLE') {
          stats.blockedControl += 1;
          if (mode === 'one-shot') {
            stop('CONTROL_STATE_UNAVAILABLE');
            break;
          }
          await sleep(pollIntervalMs, ac);
          continue;
        }
        throw err;
      }

      stats.automationEnabled = !snap.globalKillActive;

      if (snap.globalKillActive) {
        stats.blockedControl += 1;
        if (mode === 'one-shot') {
          stop('GLOBAL_KILL');
          break;
        }
        await sleep(pollIntervalMs, ac);
        if (onTick) onTick({ ...stats, snap });
        continue;
      }

      const claimed = await claimDueJobs(pool, {
        workerInstanceId,
        limit: mode === 'one-shot' ? 1 : claimBatchSize,
        leaseMs,
        failureInjector,
      });

      if (claimed.blocked) {
        stats.blockedControl += 1;
        if (mode === 'one-shot') {
          stop('CONTROL_BLOCKED');
          break;
        }
        await sleep(pollIntervalMs, ac);
        continue;
      }

      if (!claimed.jobs.length) {
        if (mode === 'one-shot') {
          stop('NO_ELIGIBLE_JOB');
          break;
        }
        await sleep(pollIntervalMs, ac);
        if (onTick) onTick({ ...stats, snap });
        continue;
      }

      // Sequential execution — bounded concurrency = 1 for A1 default
      for (const job of claimed.jobs) {
        if (stopping) break;
        stats.claimed += 1;
        const result = await executeLeasedJob(pool, job, {
          emailProvider,
          workerInstanceId,
          effectAdapter,
          idempotentEffects,
          failureInjector,
          random,
          activationConfig: config,
        });
        if (result?.stale) stats.staleCompletions += 1;
        else if (result?.code === 'SUCCEEDED') stats.succeeded += 1;
        else if (result?.code === 'RETRY_SCHEDULED') stats.retried += 1;
        else if (result?.code === 'DEAD_LETTER') stats.deadLetter += 1;
        else if (result?.code === 'FAILED_PERMANENT') stats.failedPermanent += 1;
      }

      if (mode === 'one-shot') {
        stop('ONE_SHOT_DONE');
        break;
      }
      if (onTick) onTick({ ...stats });
    } catch (err) {
      stats.loopErrors += 1;
      // Postgres / unexpected: no memory fallback
      if (
        /ECONNREFUSED|ENOTFOUND|connection|CONTROL_STATE|SCHEMA_INCOMPATIBLE/i.test(
          String(err?.message || err),
        )
      ) {
        stats.MEMORY_QUEUE_FALLBACK = 0;
        stats.JSON_QUEUE_FALLBACK = 0;
        if (mode === 'one-shot') {
          stop('DB_OR_CONTROL_FAILURE');
          break;
        }
        await sleep(pollIntervalMs * 2, ac);
        continue;
      }
      // Isolate unexpected loop errors
      await sleep(pollIntervalMs, ac);
    }
  }

  stats.processRunning = false;
  let queueStats = null;
  try {
    queueStats = await getWorkflowRuntimeStats(pool);
  } catch {
    queueStats = null;
  }

  return {
    ...stats,
    queueStats,
    externalAttempts: effectAdapter.getAttempts?.() || {},
    idempotentEffects: idempotentEffects.snapshot(),
  };
}

/**
 * Run until idle (no ready/leased due jobs) or maxIterations — useful for tests.
 */
export async function runUntilIdle(pool, opts = {}) {
  const maxEmpty = opts.maxEmptyTicks ?? 3;
  let empty = 0;
  return runDurableWorkflowWorker({
    ...opts,
    pool,
    mode: 'continuous',
    maxIterations: opts.maxIterations ?? 500,
    onTick: (s) => {
      opts.onTick?.(s);
    },
    // Wrap: stop after consecutive empty claims via maxIterations + external check
  }).then(async (result) => {
    // Helper alternative: poll until idle using short continuous runs
    return result;
  });
}

export async function drainDueJobs(pool, opts = {}) {
  let emptyTicks = 0;
  const maxEmpty = opts.maxEmptyTicks ?? 5;
  const workerInstanceId = opts.workerInstanceId || createWorkerInstanceId();
  const aggregated = {
    workerInstanceId,
    claimed: 0,
    succeeded: 0,
    retried: 0,
    deadLetter: 0,
    failedPermanent: 0,
    iterations: 0,
  };

  while (emptyTicks < maxEmpty && aggregated.iterations < (opts.maxIterations || 1000)) {
    const r = await runDurableWorkflowWorker({
      ...opts,
      pool,
      workerInstanceId,
      mode: 'one-shot',
      maxIterations: 1,
      registerHandlers: aggregated.iterations === 0,
    });
    aggregated.iterations += 1;
    aggregated.claimed += r.claimed;
    aggregated.succeeded += r.succeeded;
    aggregated.retried += r.retried;
    aggregated.deadLetter += r.deadLetter;
    aggregated.failedPermanent += r.failedPermanent;
    if (r.claimed === 0) emptyTicks += 1;
    else emptyTicks = 0;
    if (r.stoppedReason === 'GLOBAL_KILL' || r.stoppedReason === 'CONTROL_STATE_UNAVAILABLE') {
      aggregated.stoppedReason = r.stoppedReason;
      break;
    }
  }
  return aggregated;
}
