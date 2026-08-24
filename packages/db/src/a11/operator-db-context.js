/**
 * M11K — transaction-local trusted operator DB request context.
 * Context is installed only after successful M11J authorization evidence.
 */
import { OperatorCapability } from '@deintarifheld/shared';
import { OperatorAuthzCode } from './operator-authz.js';
import { resolveOperatorAuthority } from './operator-authority.js';

export const OperatorDbContextKey = Object.freeze({
  OPERATOR_ID: 'dth.operator_id',
  AUTHORITY_VERSION: 'dth.authority_version',
  REQUIRED_CAPABILITY: 'dth.required_capability',
  REQUEST_ID: 'dth.request_id',
});

export const OperatorDbContextCode = Object.freeze({
  ACTIVE_CONTEXT: 'ACTIVE_CONTEXT',
  NO_CONTEXT: 'NO_CONTEXT',
  INVALID_CONTEXT: 'INVALID_CONTEXT',
  STALE_AUTHORITY: 'STALE_AUTHORITY',
  AUTHORITY_REVOKED: 'AUTHORITY_REVOKED',
  CAPABILITY_REVOKED: 'CAPABILITY_REVOKED',
});

const VALID_CAPABILITIES = new Set(Object.values(OperatorCapability));
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateContextFields({ operatorId, authorityVersion, requiredCapability, requestId }) {
  if (!operatorId || !UUID_RE.test(String(operatorId))) {
    return { ok: false, code: OperatorDbContextCode.INVALID_CONTEXT, field: 'operatorId' };
  }
  const version = Number(authorityVersion);
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, code: OperatorDbContextCode.INVALID_CONTEXT, field: 'authorityVersion' };
  }
  if (!requiredCapability || !VALID_CAPABILITIES.has(requiredCapability)) {
    return { ok: false, code: OperatorDbContextCode.INVALID_CONTEXT, field: 'requiredCapability' };
  }
  if (!requestId || !String(requestId).trim()) {
    return { ok: false, code: OperatorDbContextCode.INVALID_CONTEXT, field: 'requestId' };
  }
  return { ok: true };
}

/**
 * Build trusted context only from successful M11J authorization result.
 * @param {import('./operator-authz.js').authorizeOperatorAction extends Function ? Awaited<ReturnType<import('./operator-authz.js').authorizeOperatorAction>> : never} authzEvidence
 */
export function buildTrustedDbRequestContext(authzEvidence, requestId) {
  if (!authzEvidence?.ok || authzEvidence.code !== OperatorAuthzCode.AUTHORIZED) {
    const err = new Error('TRUSTED_CONTEXT_REQUIRES_AUTHORIZED_M11J');
    err.code = 'TRUSTED_CONTEXT_BUILD_REJECTED';
    throw err;
  }
  const ctx = Object.freeze({
    operatorId: authzEvidence.operatorId,
    authorityVersion: authzEvidence.authorityVersion,
    requiredCapability: authzEvidence.requiredCapability,
    requestId: String(requestId).trim(),
  });
  const valid = validateContextFields(ctx);
  if (!valid.ok) {
    const err = new Error('TRUSTED_CONTEXT_INVALID');
    err.code = valid.code;
    throw err;
  }
  return ctx;
}

export async function installOperatorRequestContext(client, context) {
  const valid = validateContextFields(context);
  if (!valid.ok) {
    const err = new Error('INVALID_OPERATOR_REQUEST_CONTEXT');
    err.code = valid.code;
    throw err;
  }
  await client.query(`SELECT set_config($1, $2, true)`, [
    OperatorDbContextKey.OPERATOR_ID,
    context.operatorId,
  ]);
  await client.query(`SELECT set_config($1, $2, true)`, [
    OperatorDbContextKey.AUTHORITY_VERSION,
    String(context.authorityVersion),
  ]);
  await client.query(`SELECT set_config($1, $2, true)`, [
    OperatorDbContextKey.REQUIRED_CAPABILITY,
    context.requiredCapability,
  ]);
  await client.query(`SELECT set_config($1, $2, true)`, [
    OperatorDbContextKey.REQUEST_ID,
    context.requestId,
  ]);
}

export async function readCurrentOperatorRequestContext(client) {
  const { rows } = await client.query(
    `SELECT
       current_setting($1, true) AS operator_id,
       current_setting($2, true) AS authority_version,
       current_setting($3, true) AS required_capability,
       current_setting($4, true) AS request_id`,
    [
      OperatorDbContextKey.OPERATOR_ID,
      OperatorDbContextKey.AUTHORITY_VERSION,
      OperatorDbContextKey.REQUIRED_CAPABILITY,
      OperatorDbContextKey.REQUEST_ID,
    ],
  );
  const row = rows[0] || {};
  if (!row.operator_id || !String(row.operator_id).trim()) {
    return { ok: false, code: OperatorDbContextCode.NO_CONTEXT };
  }
  const parsed = {
    operatorId: row.operator_id,
    authorityVersion: Number(row.authority_version),
    requiredCapability: row.required_capability,
    requestId: row.request_id,
  };
  const valid = validateContextFields(parsed);
  if (!valid.ok) {
    return { ok: false, code: OperatorDbContextCode.INVALID_CONTEXT, field: valid.field };
  }
  return { ok: true, code: OperatorDbContextCode.ACTIVE_CONTEXT, context: parsed };
}

/**
 * Re-verify canonical authority at transaction start (TOCTOU protection).
 */
export async function verifyOperatorAuthorityFreshness(client, trustedContext) {
  const authority = await resolveOperatorAuthority(client, {
    operatorId: trustedContext.operatorId,
  });
  if (!authority.ok) {
    return { ok: false, code: OperatorDbContextCode.AUTHORITY_REVOKED, authorityCode: authority.code };
  }
  if (authority.authorityVersion !== trustedContext.authorityVersion) {
    return { ok: false, code: OperatorDbContextCode.STALE_AUTHORITY, currentVersion: authority.authorityVersion };
  }
  if (!authority.capabilities.includes(trustedContext.requiredCapability)) {
    return { ok: false, code: OperatorDbContextCode.CAPABILITY_REVOKED };
  }
  return { ok: true };
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ authzEvidence: object, requestId: string, verifyFreshness?: boolean }} options
 * @param {(client: import('pg').PoolClient, context: ReturnType<typeof buildTrustedDbRequestContext>) => Promise<unknown>} callback
 */
export async function withAuthorizedOperatorTransaction(
  pool,
  { authzEvidence, requestId, verifyFreshness = true },
  callback,
) {
  if (!authzEvidence?.ok) {
    return {
      ok: false,
      status: 403,
      code: 'AUTHORIZATION_REQUIRED',
      authzCode: authzEvidence?.code,
    };
  }

  let trustedContext;
  try {
    trustedContext = buildTrustedDbRequestContext(authzEvidence, requestId);
  } catch (err) {
    return { ok: false, status: 403, code: err.code || 'TRUSTED_CONTEXT_BUILD_REJECTED' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (verifyFreshness) {
      const fresh = await verifyOperatorAuthorityFreshness(client, trustedContext);
      if (!fresh.ok) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          status: fresh.code === OperatorDbContextCode.STALE_AUTHORITY ? 409 : 403,
          code: fresh.code,
          contextCode: fresh.code,
        };
      }
    }
    await installOperatorRequestContext(client, trustedContext);
    const result = await callback(client, trustedContext);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
