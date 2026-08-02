/**
 * CC AuthN / session contracts — no UI, no strong AuthZ.
 */
import { PrincipalType, isPersonPrincipal, issueCcSession } from '@deintarifheld/shared';

export const CcAuthContract = Object.freeze({
  allowedPrincipalForSession: PrincipalType.PERSON,
  strongAuthzComplete: false,
  productionIdentityReady: false,
  uiIncluded: false,
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
