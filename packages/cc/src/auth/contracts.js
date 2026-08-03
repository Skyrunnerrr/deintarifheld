/**
 * CC AuthN / session contracts — P3-F1 + P4-H0a typed status.
 * No production login UI, no Clerk SDK, no strong AuthZ.
 */
import {
  PrincipalType,
  isPersonPrincipal,
  issueCcSession,
  PRODUCTION_CC_ORIGIN,
  PRODUCTION_AUTH_UI_ORIGIN,
  PASSKEY_RP_ID,
  getPasskeyEnrollmentPolicyContract,
} from '@deintarifheld/shared';

export const CcAuthContract = Object.freeze({
  allowedPrincipalForSession: PrincipalType.PERSON,
  strongAuthzComplete: false,
  productionIdentityReady: false,
  uiIncluded: false,
  productionLoginUiAuthorized: false,
  clerkSdkInitialized: false,
  productionCcOrigin: PRODUCTION_CC_ORIGIN,
  productionAuthUiOrigin: PRODUCTION_AUTH_UI_ORIGIN,
  passkeyRpId: PASSKEY_RP_ID,
  authUiAndCcSameOrigin: true,
  passkeyPolicy: getPasskeyEnrollmentPolicyContract(),
});

export function acceptCcAuthSession(principal, authenticationMethod) {
  if (!isPersonPrincipal(principal)) {
    return {
      ok: false,
      code: 'PERSON_PRINCIPAL_REQUIRED_FOR_OPS_CC',
    };
  }
  return issueCcSession(principal, { authenticationMethod });
}

/** Protected-route input: only a validated person session object is accepted. */
export function acceptProtectedRouteSession(session) {
  if (!session || session.ccSession !== true || !session.personId) {
    return { ok: false, code: 'PROTECTED_ROUTE_SESSION_REQUIRED' };
  }
  if (session.principalType !== PrincipalType.PERSON) {
    return { ok: false, code: 'PERSON_PRINCIPAL_REQUIRED_FOR_OPS_CC' };
  }
  return { ok: true, session };
}
