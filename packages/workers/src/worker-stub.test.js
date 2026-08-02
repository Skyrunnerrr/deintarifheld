import test from 'node:test';
import assert from 'node:assert/strict';
import { KillState, WorkerRunResultCode, SYNTHETIC_NOOP_EVENT_TYPE } from '@deintarifheld/shared';
import { runOneShotLocalWorker } from './one-shot-runner.js';
import { createDenyAllEffectAdapter } from './deny-effects.js';
import { resetNoopHandlerStats, getNoopHandlerStats } from './noop-handler.js';

function positiveConfig(over = {}) {
  return {
    runtimeEnvironment: 'TEST',
    localTestFlag: true,
    automationActivation: true,
    automationEngineKillState: KillState.INACTIVE,
    persistenceAdapter: 'DISPOSABLE_LOCAL_DATABASE',
    eventType: SYNTHETIC_NOOP_EVENT_TYPE,
    externalEffectAdapter: 'DENY_ALL',
    ...over,
  };
}

test('OFF / missing activation processes zero jobs and claims nothing', async () => {
  resetNoopHandlerStats();
  let claimed = false;
  const result = await runOneShotLocalWorker({
    pool: {},
    config: positiveConfig({ automationActivation: false }),
    claimFn: async () => {
      claimed = true;
      return { id: 'x', event_type: SYNTHETIC_NOOP_EVENT_TYPE };
    },
  });
  assert.equal(result.jobsProcessed, 0);
  assert.equal(result.rowsClaimed, 0);
  assert.equal(claimed, false);
  assert.equal(getNoopHandlerStats().totalInvocations, 0);
  assert.equal(result.code, WorkerRunResultCode.BLOCKED_ACTIVATION);
});

test('kill ACTIVE blocks before claim', async () => {
  let claimed = false;
  const result = await runOneShotLocalWorker({
    pool: {},
    config: positiveConfig({ automationEngineKillState: KillState.ACTIVE }),
    claimFn: async () => {
      claimed = true;
      return { id: 'x', event_type: SYNTHETIC_NOOP_EVENT_TYPE };
    },
  });
  assert.equal(result.code, WorkerRunResultCode.BLOCKED_KILL);
  assert.equal(claimed, false);
  assert.equal(result.jobsProcessed, 0);
});

test('local test flag required even when activation YES', async () => {
  const result = await runOneShotLocalWorker({
    pool: {},
    config: positiveConfig({ localTestFlag: false }),
    claimFn: async () => ({ id: 'x', event_type: SYNTHETIC_NOOP_EVENT_TYPE }),
  });
  assert.equal(result.code, WorkerRunResultCode.BLOCKED_TEST_FLAG);
  assert.equal(result.jobsProcessed, 0);
});

test('positive path processes exactly one synthetic job and bookkeeping only', async () => {
  resetNoopHandlerStats();
  const row = {
    id: '11111111-1111-1111-1111-111111111111',
    event_type: SYNTHETIC_NOOP_EVENT_TYPE,
  };
  let processed = 0;
  const result = await runOneShotLocalWorker({
    pool: {},
    config: positiveConfig(),
    effectAdapter: createDenyAllEffectAdapter(),
    claimFn: async () => row,
    markProcessedFn: async () => {
      processed += 1;
      return true;
    },
    markFailedFn: async () => false,
  });
  assert.equal(result.code, WorkerRunResultCode.PROCESSED_ONE);
  assert.equal(result.jobsProcessed, 1);
  assert.equal(result.outboxRowsCreatedByWorker, 0);
  assert.equal(result.outboxRowsUpdatedByWorker, 1);
  assert.equal(processed, 1);
  assert.equal(getNoopHandlerStats().totalInvocations, 1);
  assert.equal(result.CONTINUOUS_LOOP_IMPLEMENTED, 'NO');
  assert.equal(result.AUTOMATIC_RETRY_IMPLEMENTED, 'NO');
});

test('already-empty claim returns no eligible job without handler call', async () => {
  resetNoopHandlerStats();
  const result = await runOneShotLocalWorker({
    pool: {},
    config: positiveConfig(),
    claimFn: async () => null,
  });
  assert.equal(result.code, WorkerRunResultCode.NO_ELIGIBLE_JOB);
  assert.equal(getNoopHandlerStats().totalInvocations, 0);
});

test('deny-all effect adapter blocks mail/http', () => {
  const a = createDenyAllEffectAdapter();
  assert.equal(a.sendMail({}).ok, false);
  assert.equal(a.httpRequest({}).ok, false);
  assert.equal(a.totals(), 2);
});

test('source contains no continuous loop / scheduler markers in runner', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, 'one-shot-runner.js'), 'utf8');
  assert.doesNotMatch(src, /setInterval|while\s*\(\s*true|node-cron|cron\.schedule/);
});
