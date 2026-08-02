/**
 * P3-F1 session contract — CC sessions require PERSON_PRINCIPAL only.
 */
import { PrincipalType, isPersonPrincipal } from './principal.js';
import { randomUUID } from 'node:crypto';

export function issueCcSession(principal, { authenticationMethod }) {
  if (!principal || !principal.type) {
    return { ok: false, code: 'PRINCIPAL_REQUIRED' };
  }
  if (!Object.values(PrincipalType).includes(principal.type)) {
    return { ok: false, code: 'UNKNOWN_PRINCIPAL_TYPE' };
  }
  if (!isPersonPrincipal(principal) || principal.ccSessionAllowed !== true) {
    return {
      ok: false,
      code: 'CC_SESSION_PERSON_PRINCIPAL_REQUIRED',
      detail: `Rejected principal type ${principal.type}`,
    };
  }
  if (!authenticationMethod) {
    return { ok: false, code: 'AUTHENTICATION_METHOD_REQUIRED' };
  }
  const session = Object.freeze({
    sessionId: randomUUID(),
    principalType: PrincipalType.PERSON,
    personId: principal.personId,
    authenticationMethod,
    issuedAt: new Date().toISOString(),
    ccSession: true,
  });
  return { ok: true, session };
}

/** Shared secret must never become a person/CC session. */
export function rejectSharedSecretAsCcSession() {
  return {
    ok: false,
    code: 'SHARED_SECRET_CC_SESSION_FORBIDDEN',
    detail: 'Shared secrets cannot create human Command-Center sessions',
  };
}
