/**
 * P4-H0b3b — local CC passkey entry gate (LOCAL_CC_ENTRY_GATE_ONLY).
 * Does not grant DTH AuthZ, Person Principal, or operational API access.
 */

export const PasskeyGateState = Object.freeze({
  CLERK_UNAVAILABLE: 'CLERK_UNAVAILABLE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  AUTHENTICATED_NO_PASSKEY: 'AUTHENTICATED_NO_PASSKEY',
  AUTHENTICATED_PASSKEY_NOT_VERIFIED: 'AUTHENTICATED_PASSKEY_NOT_VERIFIED',
  PASSKEY_VERIFIED_LOCAL_SHELL: 'PASSKEY_VERIFIED_LOCAL_SHELL',
  ERROR: 'ERROR',
});

/**
 * Evaluate local CC entry permission from Clerk session API evidence.
 * Operational API access is always denied in this tranche (no person mapping).
 *
 * @param {object} input
 * @param {boolean} input.clerkLoaded
 * @param {boolean} input.signedIn
 * @param {number} input.passkeyEnrolledCount
 * @param {boolean} input.explicitPasskeyVerificationComplete — from Session.verifyWithPasskey()
 * @param {boolean} [input.clerkError]
 */
export function evaluateLocalPasskeyGate({
  clerkLoaded,
  signedIn,
  passkeyEnrolledCount = 0,
  explicitPasskeyVerificationComplete = false,
  clerkError = false,
} = {}) {
  const denyOperational = Object.freeze({
    allowLocalNonOperationalShell: false,
    allowOperationalApiAccess: false,
    allowOperationalWrites: false,
    strongAuthzComplete: false,
  });

  if (clerkError) {
    return Object.freeze({
      state: PasskeyGateState.ERROR,
      ...denyOperational,
    });
  }
  if (!clerkLoaded) {
    return Object.freeze({
      state: PasskeyGateState.CLERK_UNAVAILABLE,
      ...denyOperational,
    });
  }
  if (!signedIn) {
    return Object.freeze({
      state: PasskeyGateState.UNAUTHENTICATED,
      ...denyOperational,
    });
  }
  if (!(Number(passkeyEnrolledCount) > 0)) {
    return Object.freeze({
      state: PasskeyGateState.AUTHENTICATED_NO_PASSKEY,
      ...denyOperational,
    });
  }
  if (!explicitPasskeyVerificationComplete) {
    return Object.freeze({
      state: PasskeyGateState.AUTHENTICATED_PASSKEY_NOT_VERIFIED,
      ...denyOperational,
    });
  }
  return Object.freeze({
    state: PasskeyGateState.PASSKEY_VERIFIED_LOCAL_SHELL,
    allowLocalNonOperationalShell: true,
    allowOperationalApiAccess: false,
    allowOperationalWrites: false,
    strongAuthzComplete: false,
  });
}

export const PasskeyGateContract = Object.freeze({
  ENFORCEMENT_METHOD: 'EXPLICIT_PASSKEY_VERIFICATION_BEFORE_LOCAL_CC_ENTRY',
  ENFORCEMENT_LEVEL: 'LOCAL_CC_ENTRY_GATE_ONLY',
  STRONG_BACKEND_AUTHZ_COMPLETE: false,
  TEMPORARY_PERSON_MAPPING_AUTHORIZED: false,
  RAW_TOKEN_HANDLING: 'FORBIDDEN',
  CLERK_NPM_SDK_INITIALIZED: false,
  CLERK_BROWSER_RUNTIME_AUTHORIZED: true,
  OPERATIONAL_API_AFTER_PASSKEY: false,
});
