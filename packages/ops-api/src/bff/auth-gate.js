/**
 * P3-F3 AuthN gate — PERSON_PRINCIPAL CC session + synthetic Owner-only local AuthZ.
 * STRONG_AUTHZ_COMPLETE=NO · CURRENT_LOCAL_AUTHZ_MODE=SYNTHETIC_OWNER_ONLY_DEV_GATE
 */
import { PrincipalType, isPersonPrincipal } from '@deintarifheld/shared';
import { SYNTHETIC_OWNER_PERSON_ID } from '../auth/local-owner-auth.js';

export function gateOpsRequest({ principal, session, sharedSecretContext } = {}) {
  if (sharedSecretContext === true) {
    return { ok: false, status: 401, code: 'SHARED_SECRET_CC_PATH_REJECTED' };
  }
  if (!principal && !session) {
    return { ok: false, status: 401, code: 'MISSING_PRINCIPAL' };
  }
  if (principal?.type === PrincipalType.SERVICE) {
    return { ok: false, status: 403, code: 'SERVICE_PRINCIPAL_REJECTED' };
  }
  if (principal?.type === PrincipalType.BREAK_GLASS) {
    return { ok: false, status: 403, code: 'BREAK_GLASS_PRINCIPAL_REJECTED' };
  }
  if (principal && !Object.values(PrincipalType).includes(principal.type)) {
    return { ok: false, status: 403, code: 'UNKNOWN_PRINCIPAL_TYPE' };
  }
  if (!session || session.ccSession !== true || !session.personId) {
    return { ok: false, status: 401, code: 'CC_PERSON_SESSION_REQUIRED' };
  }
  if (session.principalType !== PrincipalType.PERSON) {
    return { ok: false, status: 403, code: 'PERSON_PRINCIPAL_REQUIRED' };
  }
  if (principal && !isPersonPrincipal(principal)) {
    return { ok: false, status: 403, code: 'PERSON_PRINCIPAL_REQUIRED' };
  }
  if (session.personId !== SYNTHETIC_OWNER_PERSON_ID) {
    return { ok: false, status: 403, code: 'SYNTHETIC_OWNER_ONLY_DEV_GATE' };
  }
  if (principal && principal.personId !== SYNTHETIC_OWNER_PERSON_ID) {
    return { ok: false, status: 403, code: 'SYNTHETIC_OWNER_ONLY_DEV_GATE' };
  }
  return {
    ok: true,
    actorType: PrincipalType.PERSON,
    actorId: session.personId,
    sessionId: session.sessionId,
    currentLocalAuthzMode: 'SYNTHETIC_OWNER_ONLY_DEV_GATE',
    strongAuthzComplete: false,
    productionAuthzReady: false,
  };
}
