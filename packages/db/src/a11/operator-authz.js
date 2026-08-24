/**
 * M11J — fresh server-side operator capability authorization.
 * Uses M11I canonical authority only. Client role/capability fields are ignored.
 */
import {
  A11ErrorCode,
  COMMAND_REQUIRED_CAPABILITY,
  HIGH_RISK_COMMANDS,
  isOperatorCommandType,
  OperatorCapability,
} from '@deintarifheld/shared';
import {
  resolveOperatorAuthority,
  OperatorAuthorityResolutionCode,
  rejectClientOperatorRole,
  rejectClientOperatorCapabilities,
} from './operator-authority.js';

export const OperatorAuthzCode = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  OPERATOR_NOT_FOUND: 'OPERATOR_NOT_FOUND',
  OPERATOR_DISABLED: 'OPERATOR_DISABLED',
  NO_ROLE_ASSIGNMENT: 'NO_ROLE_ASSIGNMENT',
  CAPABILITY_DENIED: 'CAPABILITY_DENIED',
  AUTHORITY_DATA_UNAVAILABLE: 'AUTHORITY_DATA_UNAVAILABLE',
  STALE_AUTHORITY_VERSION: 'STALE_AUTHORITY_VERSION',
  INVALID_CAPABILITY: 'INVALID_CAPABILITY',
  IDENTITY_NOT_TRUSTED: 'IDENTITY_NOT_TRUSTED',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
});

const VALID_CAPABILITIES = new Set(Object.values(OperatorCapability));

function mapAuthorityFailure(code) {
  switch (code) {
    case OperatorAuthorityResolutionCode.INVALID_OPERATOR:
      return OperatorAuthzCode.OPERATOR_NOT_FOUND;
    case OperatorAuthorityResolutionCode.OPERATOR_DISABLED:
      return OperatorAuthzCode.OPERATOR_DISABLED;
    case OperatorAuthorityResolutionCode.NO_ROLE_ASSIGNMENT:
      return OperatorAuthzCode.NO_ROLE_ASSIGNMENT;
    case OperatorAuthorityResolutionCode.AUTHORITY_DATA_UNAVAILABLE:
      return OperatorAuthzCode.AUTHORITY_DATA_UNAVAILABLE;
    default:
      return OperatorAuthzCode.AUTHORITY_DATA_UNAVAILABLE;
  }
}

function toHttp(authzCode) {
  if (authzCode === OperatorAuthzCode.STALE_AUTHORITY_VERSION) {
    return { status: 409, a11Code: A11ErrorCode.STALE_OPERATOR_VIEW };
  }
  if (authzCode === OperatorAuthzCode.UNKNOWN_COMMAND) {
    return { status: 422, a11Code: A11ErrorCode.UNKNOWN_COMMAND };
  }
  if (authzCode === OperatorAuthzCode.INVALID_CAPABILITY) {
    return { status: 422, a11Code: A11ErrorCode.VALIDATION_FAILED };
  }
  return { status: 403, a11Code: A11ErrorCode.NOT_AUTHORIZED };
}

function rejectClientAuthorityFields(input = {}) {
  const role = rejectClientOperatorRole({ clientRole: input.clientRole });
  if (!role.ok) return role;
  const caps = rejectClientOperatorCapabilities({ clientCapabilities: input.clientCapabilities });
  if (!caps.ok) return caps;
  if (input.clientOperatorId || input.clientAuthUserId || input.clientPersonId) {
    return { ok: false, code: 'CLIENT_IDENTITY_REJECTED', authority: 0 };
  }
  return { ok: true };
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 */
export async function authorizeOperatorAction(
  pool,
  {
    operatorId,
    requiredCapability,
    expectedAuthorityVersion,
    clientRole,
    clientCapabilities,
    clientOperatorId,
    clientAuthUserId,
    clientPersonId,
  } = {},
) {
  const clientReject = rejectClientAuthorityFields({
    clientRole,
    clientCapabilities,
    clientOperatorId,
    clientAuthUserId,
    clientPersonId,
  });
  if (!clientReject.ok) {
    return { ok: false, code: OperatorAuthzCode.IDENTITY_NOT_TRUSTED, ...toHttp(OperatorAuthzCode.CAPABILITY_DENIED) };
  }

  if (!operatorId) {
    return {
      ok: false,
      code: OperatorAuthzCode.IDENTITY_NOT_TRUSTED,
      ...toHttp(OperatorAuthzCode.CAPABILITY_DENIED),
    };
  }

  if (!requiredCapability || !VALID_CAPABILITIES.has(requiredCapability)) {
    return {
      ok: false,
      code: OperatorAuthzCode.INVALID_CAPABILITY,
      ...toHttp(OperatorAuthzCode.INVALID_CAPABILITY),
    };
  }

  const authority = await resolveOperatorAuthority(pool, { operatorId });
  if (!authority.ok) {
    const code = mapAuthorityFailure(authority.code);
    return { ok: false, code, ...toHttp(code) };
  }

  if (
    expectedAuthorityVersion != null &&
    expectedAuthorityVersion !== '' &&
    Number(expectedAuthorityVersion) !== authority.authorityVersion
  ) {
    return {
      ok: false,
      code: OperatorAuthzCode.STALE_AUTHORITY_VERSION,
      operatorId: authority.operatorId,
      role: authority.role,
      authorityVersion: authority.authorityVersion,
      expectedAuthorityVersion: Number(expectedAuthorityVersion),
      ...toHttp(OperatorAuthzCode.STALE_AUTHORITY_VERSION),
    };
  }

  if (!authority.capabilities.includes(requiredCapability)) {
    return {
      ok: false,
      code: OperatorAuthzCode.CAPABILITY_DENIED,
      operatorId: authority.operatorId,
      role: authority.role,
      authorityVersion: authority.authorityVersion,
      ...toHttp(OperatorAuthzCode.CAPABILITY_DENIED),
    };
  }

  return {
    ok: true,
    code: OperatorAuthzCode.AUTHORIZED,
    operatorId: authority.operatorId,
    role: authority.role,
    capabilities: authority.capabilities,
    authorityVersion: authority.authorityVersion,
    requiredCapability,
  };
}

export async function authorizeOperatorRead(pool, input = {}) {
  return authorizeOperatorAction(pool, input);
}

export async function authorizeOperatorCommand(pool, { operatorId, commandType, expectedAuthorityVersion, ...clientFields } = {}) {
  if (!isOperatorCommandType(commandType)) {
    return {
      ok: false,
      code: OperatorAuthzCode.UNKNOWN_COMMAND,
      ...toHttp(OperatorAuthzCode.UNKNOWN_COMMAND),
    };
  }
  const requiredCapability = COMMAND_REQUIRED_CAPABILITY[commandType];
  return authorizeOperatorAction(pool, {
    operatorId,
    requiredCapability,
    expectedAuthorityVersion,
    ...clientFields,
  });
}

export function highRiskCommandsPreferAuthorityVersion() {
  return HIGH_RISK_COMMANDS;
}
