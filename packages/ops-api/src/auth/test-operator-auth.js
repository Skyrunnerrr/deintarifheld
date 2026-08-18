/**
 * E2 test operator identities. Not a production auth provider.
 */
import { createPersonPrincipal, issueCcSession, TEST_OPERATOR_IDENTITIES } from '@deintarifheld/shared';

function isProductionMode(env = process.env) {
  return (env.NODE_ENV || '').toLowerCase() === 'production';
}

function isLocalAuthEnabled(env = process.env) {
  return env.DTH_LOCAL_AUTH_ENABLED === 'true' || (env.NODE_ENV || '').toLowerCase() === 'test';
}

export function authenticateTestOperator({ identity = 'TEST_OWNER', env = process.env } = {}) {
  if (isProductionMode(env)) {
    return { ok: false, code: 'PRODUCTION_MODE_LOCAL_AUTH_DENIED' };
  }
  if (!isLocalAuthEnabled(env)) {
    return { ok: false, code: 'LOCAL_DEV_OPERATOR_AUTH_DISABLED' };
  }
  const spec = TEST_OPERATOR_IDENTITIES[identity];
  if (!spec) return { ok: false, code: 'UNKNOWN_TEST_IDENTITY' };
  const principal = createPersonPrincipal({
    personId: spec.personId,
    displayLabel: spec.label,
  });
  const sessionResult = issueCcSession(principal, {
    authenticationMethod: 'local_dev_test_operator',
  });
  if (!sessionResult.ok) return sessionResult;
  return {
    ok: true,
    SYNTHETIC_IDENTITY_ONLY: true,
    productionIdentity: false,
    identity: spec.label,
    role: spec.role,
    principal,
    session: sessionResult.session,
  };
}
