/**
 * P3-F5 worker activation — hard fail-closed.
 * AUTOMATION_ACTIVATION default / missing / invalid / unknown = NO
 */

import { KillState, isKillState } from './kill-state.js';
import { isAuthorizedSyntheticNoopEvent } from './synthetic-noop.js';

export const AutomationActivation = Object.freeze({
  YES: 'YES',
  NO: 'NO',
});

export const LOCAL_TEST_FLAG_NAME = 'DTH_LOCAL_WORKER_TEST_FLAG';

export const PersistenceAdapterKind = Object.freeze({
  DISPOSABLE_LOCAL_DATABASE: 'DISPOSABLE_LOCAL_DATABASE',
});

export const ExternalEffectAdapterKind = Object.freeze({
  DENY_ALL: 'DENY_ALL',
});

/** Normalize activation: only explicit YES enables; everything else = NO. */
export function resolveAutomationActivation(value) {
  if (value === true || value === 'YES' || value === 'true') {
    return AutomationActivation.YES;
  }
  return AutomationActivation.NO;
}

export function resolveLocalTestFlag(value) {
  return value === true || value === 'YES' || value === 'true';
}

/**
 * Canonical gate:
 * TEST_ENVIRONMENT
 * AND EXPLICIT_LOCAL_TEST_FLAG
 * AND AUTOMATION_ACTIVATION
 * AND NOT AUTOMATION_ENGINE_KILL_STATE_ACTIVE
 * AND SYNTHETIC_EVENT_ONLY
 * AND LOCAL_DATABASE_ONLY
 * AND NO_EXTERNAL_EFFECTS
 */
export function evaluateWorkerMayProcess({
  runtimeEnvironment,
  localTestFlag,
  automationActivation,
  automationEngineKillState,
  persistenceAdapter,
  eventType,
  externalEffectAdapter,
} = {}) {
  const reasons = [];

  const env = String(runtimeEnvironment || '').toUpperCase();
  if (env !== 'TEST') {
    reasons.push('RUNTIME_ENVIRONMENT_NOT_TEST');
  }

  const testFlag = resolveLocalTestFlag(localTestFlag);
  if (!testFlag) {
    reasons.push('LOCAL_TEST_FLAG_REQUIRED');
  }

  const activation = resolveAutomationActivation(automationActivation);
  if (activation !== AutomationActivation.YES) {
    reasons.push('AUTOMATION_ACTIVATION_NO');
  }

  if (!isKillState(automationEngineKillState)) {
    reasons.push('KILL_STATE_MALFORMED_FAIL_CLOSED');
  } else if (automationEngineKillState === KillState.ACTIVE) {
    reasons.push('AUTOMATION_ENGINE_KILL_ACTIVE');
  }

  if (persistenceAdapter !== PersistenceAdapterKind.DISPOSABLE_LOCAL_DATABASE) {
    reasons.push('PERSISTENCE_ADAPTER_NOT_LOCAL');
  }

  if (!isAuthorizedSyntheticNoopEvent(eventType)) {
    reasons.push('EVENT_TYPE_NOT_AUTHORIZED_SYNTHETIC_NOOP');
  }

  if (externalEffectAdapter !== ExternalEffectAdapterKind.DENY_ALL) {
    reasons.push('EXTERNAL_EFFECT_ADAPTER_NOT_DENY_ALL');
  }

  const mayProcess = reasons.length === 0;
  return {
    WORKER_MAY_PROCESS: mayProcess ? 'YES' : 'NO',
    mayProcess,
    automationActivation: activation,
    localTestFlag: testFlag,
    reasons,
    AUTOMATION_ACTIVATION_DEFAULT: AutomationActivation.NO,
    LOCAL_TEST_FLAG_DEFAULT: false,
    PRODUCTION_EXACTLY_ONCE_GUARANTEE: 'NO',
  };
}
