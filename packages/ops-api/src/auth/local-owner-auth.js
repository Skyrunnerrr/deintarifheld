/**
 * Local/dev synthetic Owner AuthN — fail-closed in production.
 * No real credentials. No shared secret as owner login.
 */
import {
  createPersonPrincipal,
  issueCcSession,
} from '@deintarifheld/shared';

export const SYNTHETIC_OWNER_PERSON_ID = 'person_synth_owner_dth_local_001';

function isProductionMode(env = process.env) {
  return (env.NODE_ENV || '').toLowerCase() === 'production';
}

function isLocalAuthEnabled(env = process.env) {
  return env.DTH_LOCAL_AUTH_ENABLED === 'true';
}

/**
 * Attempt local owner authentication.
 * Allowed only when NOT production AND DTH_LOCAL_AUTH_ENABLED=true.
 */
export function authenticateLocalOwner({ env = process.env } = {}) {
  if (isProductionMode(env)) {
    return {
      ok: false,
      code: 'PRODUCTION_MODE_LOCAL_AUTH_DENIED',
      PRODUCTION_MODE_LOCAL_AUTH: 'DENIED',
    };
  }
  if (!isLocalAuthEnabled(env)) {
    return {
      ok: false,
      code: 'LOCAL_DEV_OWNER_AUTH_DISABLED',
      LOCAL_DEV_OWNER_AUTH: 'DISABLED',
    };
  }

  const principal = createPersonPrincipal({
    personId: SYNTHETIC_OWNER_PERSON_ID,
    displayLabel: 'synthetic-local-owner',
  });
  const sessionResult = issueCcSession(principal, {
    authenticationMethod: 'local_dev_owner',
  });
  if (!sessionResult.ok) return sessionResult;

  return {
    ok: true,
    LOCAL_DEV_OWNER_AUTH: 'PASS',
    SYNTHETIC_IDENTITY_ONLY: true,
    principal,
    session: sessionResult.session,
  };
}

/** Map a shared-secret style credential attempt — always forbidden for CC person session. */
export function authenticateSharedSecretAsOwner() {
  return {
    ok: false,
    code: 'SHARED_SECRET_AS_OWNER_LOGIN_FORBIDDEN',
    detail: 'Shared secrets cannot authenticate a human Owner CC session',
  };
}
