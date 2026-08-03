/**
 * P4-H0a Ops-API boundary: validated provider token → P3-F1 Person Principal.
 * No Clerk SDK, no remote JWKS, no Strong AuthZ.
 */
import {
  authenticateProviderTokenToPersonPrincipal,
  rejectNonPersonAsPersonSession,
  EXPECTED_AUTHORIZED_PARTY,
} from '@deintarifheld/shared';
import { authenticateLocalOwner, authenticateSharedSecretAsOwner } from './local-owner-auth.js';

/**
 * Authenticate via injected local validation stack (synthetic or future H0b adapters).
 */
export async function authenticateOpsPersonFromProviderToken(opts) {
  return authenticateProviderTokenToPersonPrincipal({
    expectedAuthorizedParty: EXPECTED_AUTHORIZED_PARTY,
    ...opts,
  });
}

/** Production must reject local bootstrap; keep explicit regression helper. */
export function assertProductionLocalAuthRejected(env = { NODE_ENV: 'production' }) {
  return authenticateLocalOwner({ env });
}

export function assertSharedSecretRejectedAsPerson() {
  const shared = authenticateSharedSecretAsOwner();
  const typed = rejectNonPersonAsPersonSession('SHARED_SECRET');
  return {
    sharedSecretOwner: shared,
    sharedSecretAsPerson: typed,
  };
}
