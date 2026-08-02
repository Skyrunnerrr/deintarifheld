import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KillDomain,
  KILL_DOMAINS,
  KILL_DOMAIN_COUNT,
  assertExactKillDomainSet,
  isKillDomain,
} from './kill-domains.js';
import { KillState, evaluateCapabilityEnabled, isKillState } from './kill-state.js';
import { LOCAL_DEV_KILL_DEFAULTS, createDefaultKillRegistry } from './kill-defaults.js';

test('exactly eight kill domains registered', () => {
  assert.equal(KILL_DOMAIN_COUNT, 8);
  assert.equal(KILL_DOMAINS.length, 8);
  assertExactKillDomainSet(KILL_DOMAINS);
});

test('unknown domain rejected by isKillDomain', () => {
  assert.equal(isKillDomain('NINTH_DOMAIN'), false);
  assert.equal(isKillDomain(KillDomain.PUBLIC_INTAKE), true);
});

test('kill state semantics and capability invariant fail-closed', () => {
  assert.equal(isKillState(KillState.ACTIVE), true);
  assert.equal(isKillState('true'), false);
  const blocked = evaluateCapabilityEnabled({
    ownerAuthorized: true,
    policyGateOpen: true,
    killState: KillState.ACTIVE,
  });
  assert.equal(blocked.enabled, false);
  const inactiveStillNeedsAuth = evaluateCapabilityEnabled({
    ownerAuthorized: false,
    policyGateOpen: false,
    killState: KillState.INACTIVE,
  });
  assert.equal(inactiveStillNeedsAuth.enabled, false);
  assert.match(inactiveStillNeedsAuth.note, /DOES_NOT_AUTHORIZE/);
  const malformed = evaluateCapabilityEnabled({ killState: 'YES' });
  assert.equal(malformed.enabled, false);
});

test('local/dev defaults cover all eight domains with safe posture', () => {
  const reg = createDefaultKillRegistry();
  assertExactKillDomainSet(Object.keys(reg));
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.PUBLIC_INTAKE, KillState.INACTIVE);
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.API_PROCESSING, KillState.INACTIVE);
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.INTERNAL_MAIL, KillState.INACTIVE);
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.MARKETING_MAIL, KillState.ACTIVE);
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.AUTOMATION_ENGINE, KillState.ACTIVE);
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.DATA_IMPORT, KillState.ACTIVE);
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.PARTNER_ACCESS, KillState.ACTIVE);
  assert.equal(LOCAL_DEV_KILL_DEFAULTS.COMMAND_CENTER_WRITE_ACTIONS, KillState.ACTIVE);
});
