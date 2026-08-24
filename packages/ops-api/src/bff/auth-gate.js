/**
 * P3-F3 AuthN gate — PERSON_PRINCIPAL CC session + synthetic Owner-only local AuthZ.
 * A11 adds capability AuthZ over test identities. Client role is not authority.
 * STRONG_AUTHZ_COMPLETE=NO · CURRENT_LOCAL_AUTHZ_MODE=SYNTHETIC_OWNER_ONLY_DEV_GATE
 */
import { PrincipalType, isPersonPrincipal, TEST_OPERATOR_BY_PERSON_ID, TEST_OPERATOR_ID_BY_PERSON_ID } from '@deintarifheld/shared';
import { SYNTHETIC_OWNER_PERSON_ID } from '../auth/local-owner-auth.js';

function personSessionOrDeny({ principal, session, sharedSecretContext } = {}) {
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
  return { ok: true };
}

export function gateOpsRequest({ principal, session, sharedSecretContext } = {}) {
  const base = personSessionOrDeny({ principal, session, sharedSecretContext });
  if (!base.ok) return base;
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

export function gateA11Request({ principal, session, sharedSecretContext, claimedRole } = {}) {
  const base = personSessionOrDeny({ principal, session, sharedSecretContext });
  if (!base.ok) return { ...base, code: base.code === 'MISSING_PRINCIPAL' ? 'SESSION_MISSING' : base.code };
  const bound = TEST_OPERATOR_BY_PERSON_ID[session.personId];
  if (!bound) {
    return { ok: false, status: 403, code: 'NOT_AUTHORIZED' };
  }
  const operatorId = TEST_OPERATOR_ID_BY_PERSON_ID[session.personId] || null;
  if (!operatorId) {
    return { ok: false, status: 403, code: 'NOT_AUTHORIZED' };
  }
  const forged = Boolean(claimedRole && claimedRole !== bound.role);
  return {
    ok: true,
    actorType: PrincipalType.PERSON,
    actorId: bound.personId,
    sessionId: session.sessionId,
    personId: bound.personId,
    operatorId,
    label: bound.label,
    identitySource: 'TEST_E2_ONLY',
    productionIdentity: false,
    forgedRoleIgnored: forged,
    strongAuthzComplete: false,
    productionAuthzReady: false,
    currentLocalAuthzMode: 'A11_M11J_TEST_IDENTITY_GATE',
  };
}
