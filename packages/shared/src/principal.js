/**
 * P3-F1 Person-identity AuthN foundation — principal types.
 * STRONG_AUTHZ_COMPLETE=NO · PRODUCTION_IDENTITY_READY=NO
 */

export const PrincipalType = Object.freeze({
  PERSON: 'PERSON_PRINCIPAL',
  SERVICE: 'SERVICE_PRINCIPAL',
  BREAK_GLASS: 'BREAK_GLASS_PRINCIPAL',
});

export function createPersonPrincipal({ personId, displayLabel = 'synthetic-person' }) {
  if (!personId || typeof personId !== 'string') {
    throw new Error('PERSON_ID_REQUIRED');
  }
  return Object.freeze({
    type: PrincipalType.PERSON,
    personId,
    displayLabel,
    ccSessionAllowed: true,
  });
}

export function createServicePrincipal({ serviceId }) {
  if (!serviceId) throw new Error('SERVICE_ID_REQUIRED');
  return Object.freeze({
    type: PrincipalType.SERVICE,
    serviceId,
    ccSessionAllowed: false,
  });
}

export function createBreakGlassPrincipal({ breakGlassId = 'break_glass_technical' } = {}) {
  return Object.freeze({
    type: PrincipalType.BREAK_GLASS,
    breakGlassId,
    ccSessionAllowed: false,
    note: 'SECRET_ADMIN=BREAK_GLASS_ONLY — never a human CC session',
  });
}

export function isPersonPrincipal(principal) {
  return Boolean(principal && principal.type === PrincipalType.PERSON && principal.personId);
}
