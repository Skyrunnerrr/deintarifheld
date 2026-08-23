/**
 * M11H — resolve verified Supabase Auth subject → stable DTH operator identity.
 * No roles/capabilities. Fail closed. No email/metadata/client identity authority.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const OperatorIdentityResolutionCode = Object.freeze({
  ACTIVE_OPERATOR: 'ACTIVE_OPERATOR',
  NOT_PROVISIONED: 'NOT_PROVISIONED',
  DISABLED: 'DISABLED',
  INVALID_SUBJECT: 'INVALID_SUBJECT',
  AMBIGUOUS_BINDING: 'AMBIGUOUS_BINDING',
  DATA_UNAVAILABLE: 'DATA_UNAVAILABLE',
});

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ verifiedAuthUserId?: string }} input — server-verified subject only
 */
export async function resolveOperatorByVerifiedAuthSubject(pool, { verifiedAuthUserId } = {}) {
  if (!isUuid(verifiedAuthUserId)) {
    return {
      ok: false,
      code: OperatorIdentityResolutionCode.INVALID_SUBJECT,
      operatorId: null,
      authority: 0,
    };
  }

  try {
    const { rows } = await pool.query(
      `SELECT o.operator_id, o.status AS operator_status, m.status AS binding_status
       FROM security.operator_auth_identities m
       JOIN security.operators o ON o.operator_id = m.operator_id
       WHERE m.auth_user_id = $1::uuid
         AND m.status = 'ACTIVE'
       LIMIT 2`,
      [verifiedAuthUserId],
    );

    if (rows.length === 0) {
      return {
        ok: false,
        code: OperatorIdentityResolutionCode.NOT_PROVISIONED,
        operatorId: null,
        authority: 0,
      };
    }
    if (rows.length > 1) {
      return {
        ok: false,
        code: OperatorIdentityResolutionCode.AMBIGUOUS_BINDING,
        operatorId: null,
        authority: 0,
      };
    }

    const row = rows[0];
    if (row.operator_status !== 'ACTIVE' || row.binding_status !== 'ACTIVE') {
      return {
        ok: false,
        code: OperatorIdentityResolutionCode.DISABLED,
        operatorId: row.operator_id,
        authority: 0,
      };
    }

    return {
      ok: true,
      code: OperatorIdentityResolutionCode.ACTIVE_OPERATOR,
      operatorId: row.operator_id,
      authority: 1,
    };
  } catch {
    return {
      ok: false,
      code: OperatorIdentityResolutionCode.DATA_UNAVAILABLE,
      operatorId: null,
      authority: 0,
    };
  }
}

/**
 * Explicit guard: client-supplied operator identity must never authorize.
 */
export function rejectClientOperatorIdentity({ clientOperatorId, clientAuthUserId } = {}) {
  if (clientOperatorId || clientAuthUserId) {
    return { ok: false, code: 'CLIENT_IDENTITY_REJECTED', authority: 0 };
  }
  return { ok: true, authority: 0 };
}

/**
 * Explicit guard: email / user_metadata must not confer operator authority.
 */
export function rejectMetadataOperatorAuthority({ email, userMetadata } = {}) {
  const roleClaim = userMetadata?.role || userMetadata?.operatorRole;
  if (email || roleClaim) {
    return { ok: false, code: 'METADATA_IDENTITY_REJECTED', authority: 0 };
  }
  return { ok: true, authority: 0 };
}
