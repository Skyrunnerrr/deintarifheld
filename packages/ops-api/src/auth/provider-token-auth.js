/**
 * P4-H0a/H0b2a Ops-API boundary: validated provider token → P3-F1 Person Principal.
 * H0b2a: remote JWKS adapter may be injected; no Clerk SDK; no secret-key verify.
 * Real Clerk session-token evidence deferred to P4-H0b2b after H0b3.
 */
import {
  authenticateProviderTokenToPersonPrincipal,
  rejectNonPersonAsPersonSession,
  AUTHORIZED_PARTY_ALLOWLIST,
  EXPECTED_AUDIENCE,
} from '@deintarifheld/shared';
import { authenticateLocalOwner, authenticateSharedSecretAsOwner } from './local-owner-auth.js';

/**
 * Authenticate via injected validation stack (synthetic static JWKS or remote Development JWKS).
 * Unknown real Clerk subjects remain rejected until mapping exists (H0b-MAP / later gates).
 */
export async function authenticateOpsPersonFromProviderToken(opts) {
  return authenticateProviderTokenToPersonPrincipal({
    ...opts,
    expectedAudience: opts.expectedAudience ?? EXPECTED_AUDIENCE,
    expectedAuthorizedParty: opts.expectedAuthorizedParty ?? AUTHORIZED_PARTY_ALLOWLIST,
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
