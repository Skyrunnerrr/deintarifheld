/**
 * Passkey / enrollment policy contracts for H0a — not live Clerk enforcement.
 */
import { AuthAssuranceMethod, PasskeyPolicy } from './h0a-constants.js';
import { TokenErrorCode, fail } from './token-errors.js';

export function getPasskeyEnrollmentPolicyContract() {
  return Object.freeze({
    ...PasskeyPolicy,
    PASSKEY_POLICY_CONTRACT_DEFINED: true,
    INITIAL_ENROLLMENT_METHOD: 'INVITATION_PLUS_VERIFIED_EMAIL_OTP',
    EMAIL_OTP_ALLOWED_FOR: Object.freeze([
      'controlled initial enrollment',
      'explicitly initiated account recovery',
    ]),
    LIVE_WEBAUTHN_IMPLEMENTED: false,
    ENROLLMENT_UI_IMPLEMENTED: false,
  });
}

/**
 * Operational CC access requires passkey assurance evidence (synthetic in H0a).
 */
export function evaluateOperationalPasskeyAssurance(authenticationEvidence) {
  if (authenticationEvidence === AuthAssuranceMethod.PASSKEY) {
    return { ok: true, PASSKEY_POLICY_LOCALLY_TESTED: true };
  }
  if (
    authenticationEvidence === AuthAssuranceMethod.EMAIL_OTP_ENROLLMENT ||
    authenticationEvidence === AuthAssuranceMethod.EMAIL_OTP_RECOVERY
  ) {
    return fail(TokenErrorCode.EMAIL_OTP_OPERATIONAL_ACCESS_REJECTED);
  }
  return fail(TokenErrorCode.PASSKEY_ASSURANCE_REQUIRED);
}
