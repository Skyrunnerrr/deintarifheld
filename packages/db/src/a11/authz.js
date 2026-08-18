/**
 * Server-derived operator identity. Client role fields are data only.
 */
import {
  TEST_OPERATOR_BY_PERSON_ID,
  capabilitiesForRole,
  COMMAND_REQUIRED_CAPABILITY,
  A11ErrorCode,
  isOperatorCommandType,
} from '@deintarifheld/shared';

export function resolveOperatorIdentity(session = {}, { claimedRole } = {}) {
  if (!session || session.ccSession !== true || !session.personId) {
    return { ok: false, status: 401, code: A11ErrorCode.SESSION_MISSING };
  }
  const bound = TEST_OPERATOR_BY_PERSON_ID[session.personId];
  if (!bound) {
    return { ok: false, status: 403, code: A11ErrorCode.NOT_AUTHORIZED };
  }
  const forged = claimedRole && claimedRole !== bound.role;
  return {
    ok: true,
    personId: bound.personId,
    role: bound.role,
    label: bound.label,
    capabilities: capabilitiesForRole(bound.role),
    productionIdentity: false,
    forgedRoleIgnored: forged === true,
    forgedRoleCode: forged ? A11ErrorCode.FORGED_ROLE_IGNORED : null,
  };
}

export function authorizeCommand(identity, commandType) {
  if (!identity?.ok) return identity;
  if (!isOperatorCommandType(commandType)) {
    return { ok: false, status: 422, code: A11ErrorCode.UNKNOWN_COMMAND };
  }
  const needed = COMMAND_REQUIRED_CAPABILITY[commandType];
  if (!needed || !identity.capabilities.includes(needed)) {
    return { ok: false, status: 403, code: A11ErrorCode.NOT_AUTHORIZED };
  }
  return { ok: true };
}

export function authorizeRead(identity, capability) {
  if (!identity?.ok) return identity;
  if (!identity.capabilities.includes(capability)) {
    return { ok: false, status: 403, code: A11ErrorCode.NOT_AUTHORIZED };
  }
  return { ok: true };
}
