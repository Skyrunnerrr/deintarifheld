/**
 * Ops/CC session gate — person principal required.
 */
import {
  createBreakGlassPrincipal,
  createServicePrincipal,
  issueCcSession,
  rejectSharedSecretAsCcSession,
  isPersonPrincipal,
} from '@deintarifheld/shared';

export function requirePersonCcSession(principal, authenticationMethod) {
  if (!principal) {
    return { ok: false, code: 'PRINCIPAL_REQUIRED' };
  }
  if (!isPersonPrincipal(principal)) {
    return {
      ok: false,
      code: 'PERSON_PRINCIPAL_REQUIRED_FOR_OPS_CC',
      detail: `Got ${principal.type}`,
    };
  }
  return issueCcSession(principal, { authenticationMethod });
}

export function attemptSharedSecretCcSession() {
  return rejectSharedSecretAsCcSession();
}

export function attemptServiceCcSession(serviceId = 'svc_ops') {
  return issueCcSession(createServicePrincipal({ serviceId }), {
    authenticationMethod: 'shared_secret',
  });
}

export function attemptBreakGlassCcSession() {
  return issueCcSession(createBreakGlassPrincipal(), {
    authenticationMethod: 'shared_secret',
  });
}
