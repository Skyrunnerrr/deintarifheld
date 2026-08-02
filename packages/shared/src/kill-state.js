/**
 * P3-F6 kill-state semantics — fail-closed; no capability activation.
 *
 * KILL_STATE=ACTIVE   → domain is blocked/paused by kill override
 * KILL_STATE=INACTIVE → no kill override is active
 *
 * CAPABILITY_AUTHORIZATION and KILL_STATE are separate controls.
 * KILL_STATE_INACTIVE does NOT authorize automation, marketing, partner
 * access, mail sending, or Command-Center writes.
 *
 * CAPABILITY_ENABLED =
 *   OWNER_AUTHORIZATION AND POLICY_GATE AND NOT KILL_STATE_ACTIVE
 */

export const KillState = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

export function isKillState(value) {
  return value === KillState.ACTIVE || value === KillState.INACTIVE;
}

/**
 * Pure invariant helper — does not grant Owner/policy authorization.
 * Missing/malformed inputs fail closed (enabled=false).
 */
export function evaluateCapabilityEnabled({
  ownerAuthorized = false,
  policyGateOpen = false,
  killState,
} = {}) {
  if (!isKillState(killState)) {
    return {
      enabled: false,
      code: 'KILL_STATE_MALFORMED_FAIL_CLOSED',
      killActive: true,
    };
  }
  const killActive = killState === KillState.ACTIVE;
  const enabled = Boolean(ownerAuthorized) && Boolean(policyGateOpen) && !killActive;
  return {
    enabled,
    killActive,
    killState,
    invariant: 'OWNER_AUTHORIZATION AND POLICY_GATE AND NOT KILL_STATE_ACTIVE',
    note: 'KILL_STATE_INACTIVE_DOES_NOT_AUTHORIZE_CAPABILITY',
  };
}
