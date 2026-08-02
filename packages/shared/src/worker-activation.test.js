import test from 'node:test';
import assert from 'node:assert/strict';
import { KillState } from './kill-state.js';
import { SYNTHETIC_NOOP_EVENT_TYPE } from './synthetic-noop.js';
import {
  evaluateWorkerMayProcess,
  resolveAutomationActivation,
  PersistenceAdapterKind,
  ExternalEffectAdapterKind,
  AutomationActivation,
} from './worker-activation.js';

function base(over = {}) {
  return {
    runtimeEnvironment: 'TEST',
    localTestFlag: true,
    automationActivation: true,
    automationEngineKillState: KillState.INACTIVE,
    persistenceAdapter: PersistenceAdapterKind.DISPOSABLE_LOCAL_DATABASE,
    eventType: SYNTHETIC_NOOP_EVENT_TYPE,
    externalEffectAdapter: ExternalEffectAdapterKind.DENY_ALL,
    ...over,
  };
}

test('automation activation defaults fail-closed', () => {
  assert.equal(resolveAutomationActivation(undefined), AutomationActivation.NO);
  assert.equal(resolveAutomationActivation('maybe'), AutomationActivation.NO);
  assert.equal(resolveAutomationActivation('YES'), AutomationActivation.YES);
});

test('worker may process only when all gates pass', () => {
  assert.equal(evaluateWorkerMayProcess(base()).mayProcess, true);
  assert.equal(evaluateWorkerMayProcess(base({ automationActivation: false })).mayProcess, false);
  assert.equal(evaluateWorkerMayProcess(base({ localTestFlag: false })).mayProcess, false);
  assert.equal(
    evaluateWorkerMayProcess(base({ automationEngineKillState: KillState.ACTIVE })).mayProcess,
    false,
  );
  assert.equal(evaluateWorkerMayProcess(base({ runtimeEnvironment: 'development' })).mayProcess, false);
  assert.equal(evaluateWorkerMayProcess(base({ eventType: 'CASE_NOTE_RECORDED' })).mayProcess, false);
  assert.equal(
    evaluateWorkerMayProcess(base({ externalEffectAdapter: 'ALLOW' })).mayProcess,
    false,
  );
});
