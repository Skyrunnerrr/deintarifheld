/**
 * Provider-neutral external identity contract.
 * External subject ≠ DTH person id. No roles/capabilities in this object.
 */
import { IdentityProvider } from './h0a-constants.js';

export function createExternalProviderIdentity({
  provider = IdentityProvider.CLERK,
  issuer,
  subject,
  sessionId,
  issuedAt,
  notBefore,
  expiresAt,
  authorizedParty,
  audience,
  authenticationEvidence,
  tokenIdOptional,
}) {
  if (provider !== IdentityProvider.CLERK) {
    return { ok: false, code: 'IDENTITY_PROVIDER_MISMATCH' };
  }
  if (!issuer || !subject || !sessionId) {
    return { ok: false, code: 'TOKEN_MALFORMED' };
  }
  return {
    ok: true,
    identity: Object.freeze({
      provider: IdentityProvider.CLERK,
      issuer,
      subject,
      sessionId,
      issuedAt,
      notBefore,
      expiresAt,
      authorizedParty,
      audience,
      authenticationEvidence: authenticationEvidence || null,
      tokenIdOptional: tokenIdOptional || null,
      EXTERNAL_PROVIDER_SUBJECT: subject,
      // Explicit non-fields: no DTH roles, capabilities, Owner flags, email as key
    }),
  };
}
