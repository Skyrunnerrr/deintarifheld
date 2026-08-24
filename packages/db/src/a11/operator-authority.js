/**
 * M11I — resolve stable operator_id → canonical role + explicit capabilities.
 * No HTTP/command enforcement (M11J). No auth-subject lookup (M11H). Fail closed.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const OperatorAuthorityResolutionCode = Object.freeze({
  ACTIVE_AUTHORITY: 'ACTIVE_AUTHORITY',
  OPERATOR_DISABLED: 'OPERATOR_DISABLED',
  NO_ROLE_ASSIGNMENT: 'NO_ROLE_ASSIGNMENT',
  INVALID_OPERATOR: 'INVALID_OPERATOR',
  AUTHORITY_DATA_UNAVAILABLE: 'AUTHORITY_DATA_UNAVAILABLE',
});

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ operatorId?: string }} input — M11H-resolved operator_id only
 */
export async function resolveOperatorAuthority(pool, { operatorId } = {}) {
  if (!isUuid(operatorId)) {
    return {
      ok: false,
      code: OperatorAuthorityResolutionCode.INVALID_OPERATOR,
      operatorId: null,
      role: null,
      capabilities: [],
      authorityVersion: null,
      authority: 0,
    };
  }

  try {
    const { rows: operatorRows } = await pool.query(
      `SELECT operator_id, status FROM security.operators WHERE operator_id = $1::uuid`,
      [operatorId],
    );

    if (operatorRows.length === 0) {
      return {
        ok: false,
        code: OperatorAuthorityResolutionCode.INVALID_OPERATOR,
        operatorId,
        role: null,
        capabilities: [],
        authorityVersion: null,
        authority: 0,
      };
    }

    if (operatorRows[0].status !== 'ACTIVE') {
      return {
        ok: false,
        code: OperatorAuthorityResolutionCode.OPERATOR_DISABLED,
        operatorId,
        role: null,
        capabilities: [],
        authorityVersion: null,
        authority: 0,
      };
    }

    const { rows: assignmentRows } = await pool.query(
      `SELECT role_code, authority_version
       FROM security.operator_role_assignments
       WHERE operator_id = $1::uuid AND status = 'ACTIVE'
       LIMIT 2`,
      [operatorId],
    );

    if (assignmentRows.length === 0) {
      return {
        ok: false,
        code: OperatorAuthorityResolutionCode.NO_ROLE_ASSIGNMENT,
        operatorId,
        role: null,
        capabilities: [],
        authorityVersion: null,
        authority: 0,
      };
    }

    if (assignmentRows.length > 1) {
      return {
        ok: false,
        code: OperatorAuthorityResolutionCode.AUTHORITY_DATA_UNAVAILABLE,
        operatorId,
        role: null,
        capabilities: [],
        authorityVersion: null,
        authority: 0,
      };
    }

    const assignment = assignmentRows[0];
    const { rows: capRows } = await pool.query(
      `SELECT rc.capability_code
       FROM security.role_capabilities rc
       JOIN security.operator_capabilities c ON c.capability_code = rc.capability_code
       WHERE rc.role_code = $1 AND c.status = 'ACTIVE'
       ORDER BY rc.capability_code`,
      [assignment.role_code],
    );

    const capabilities = capRows.map((row) => row.capability_code);

    return {
      ok: true,
      code: OperatorAuthorityResolutionCode.ACTIVE_AUTHORITY,
      operatorId,
      role: assignment.role_code,
      capabilities,
      authorityVersion: Number(assignment.authority_version),
      authority: capabilities.length > 0 ? 1 : 0,
    };
  } catch {
    return {
      ok: false,
      code: OperatorAuthorityResolutionCode.AUTHORITY_DATA_UNAVAILABLE,
      operatorId,
      role: null,
      capabilities: [],
      authorityVersion: null,
      authority: 0,
    };
  }
}

/** Client-supplied role must never confer authority. */
export function rejectClientOperatorRole({ clientRole } = {}) {
  if (clientRole) {
    return { ok: false, code: 'CLIENT_ROLE_REJECTED', authority: 0 };
  }
  return { ok: true, authority: 0 };
}

/** Client-supplied capability list must never confer authority. */
export function rejectClientOperatorCapabilities({ clientCapabilities } = {}) {
  if (Array.isArray(clientCapabilities) && clientCapabilities.length > 0) {
    return { ok: false, code: 'CLIENT_CAPABILITIES_REJECTED', authority: 0 };
  }
  if (clientCapabilities && !Array.isArray(clientCapabilities)) {
    return { ok: false, code: 'CLIENT_CAPABILITIES_REJECTED', authority: 0 };
  }
  return { ok: true, authority: 0 };
}
