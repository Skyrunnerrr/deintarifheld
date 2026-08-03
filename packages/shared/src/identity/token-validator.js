/**
 * Fail-closed Clerk-shaped JWT validation (local / synthetic JWKS only).
 */
import { parseJwtUnverified, verifyRs256Signature } from './jwt-crypto.js';
import { createExternalProviderIdentity } from './provider-identity.js';
import { TokenErrorCode, fail } from './token-errors.js';
import {
  IdentityProvider,
  AUTHORIZED_PARTY_ALLOWLIST,
} from './h0a-constants.js';

const ALLOWED_ALG = 'RS256';
/** Max skew for iat-in-future rejection (seconds). */
const IAT_FUTURE_SKEW_SECONDS = 60;

function normalizeAuthorizedPartyAllowlist(expectedAuthorizedParty) {
  if (expectedAuthorizedParty == null) {
    return [...AUTHORIZED_PARTY_ALLOWLIST];
  }
  if (Array.isArray(expectedAuthorizedParty)) {
    return expectedAuthorizedParty.filter((x) => typeof x === 'string' && x.length > 0);
  }
  if (typeof expectedAuthorizedParty === 'string' && expectedAuthorizedParty) {
    return [expectedAuthorizedParty];
  }
  return [];
}

/**
 * @param {object} opts
 * @param {string} opts.token
 * @param {object} opts.jwksAdapter — static or remote JWKS adapter
 * @param {string} opts.expectedIssuer
 * @param {string} opts.expectedAudience — required (H0b2a: urn:deintarifheld:ops-api)
 * @param {string|string[]} [opts.expectedAuthorizedParty] — exact allowlist; default AUTHORIZED_PARTY_ALLOWLIST
 * @param {() => number} [opts.nowSeconds] — deterministic clock
 */
export async function validateProviderToken({
  token,
  jwksAdapter,
  expectedIssuer,
  expectedAudience,
  expectedAuthorizedParty,
  nowSeconds = () => Math.floor(Date.now() / 1000),
}) {
  if (!expectedIssuer || !expectedAudience) {
    return fail(TokenErrorCode.TOKEN_MALFORMED, 'EXPECTED_ISSUER_AND_AUDIENCE_POLICY_REQUIRED');
  }
  const azpAllowlist = normalizeAuthorizedPartyAllowlist(expectedAuthorizedParty);
  if (azpAllowlist.length === 0) {
    return fail(TokenErrorCode.TOKEN_MALFORMED, 'AUTHORIZED_PARTY_ALLOWLIST_REQUIRED');
  }
  if (!jwksAdapter || typeof jwksAdapter.getKeyByKid !== 'function') {
    return fail(TokenErrorCode.TOKEN_MALFORMED, 'JWKS_ADAPTER_REQUIRED');
  }

  const parsed = parseJwtUnverified(token);
  if (!parsed.ok) {
    return fail(TokenErrorCode.TOKEN_MALFORMED);
  }

  const { header, payload, signingInput, signatureB64 } = parsed;

  if (!signatureB64) {
    return fail(TokenErrorCode.TOKEN_UNSIGNED);
  }
  if (!header || typeof header !== 'object') {
    return fail(TokenErrorCode.TOKEN_MALFORMED);
  }
  if (header.alg === 'none' || header.alg === 'None' || header.alg === 'NONE') {
    return fail(TokenErrorCode.TOKEN_ALG_NONE_REJECTED);
  }
  if (header.alg !== ALLOWED_ALG) {
    return fail(TokenErrorCode.TOKEN_ALG_UNSUPPORTED);
  }
  if (!header.kid) {
    return fail(TokenErrorCode.TOKEN_KEY_UNKNOWN);
  }

  const keyResult = await jwksAdapter.getKeyByKid(header.kid);
  if (!keyResult.ok) {
    return fail(keyResult.code || TokenErrorCode.TOKEN_KEY_UNKNOWN);
  }

  const sigOk = verifyRs256Signature({
    signingInput,
    signatureB64,
    publicKeyPem: keyResult.publicKeyPem,
  });
  if (!sigOk) {
    return fail(TokenErrorCode.TOKEN_SIGNATURE_INVALID);
  }

  if (payload.iss !== expectedIssuer) {
    return fail(TokenErrorCode.TOKEN_ISSUER_INVALID);
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    return fail(TokenErrorCode.TOKEN_SUBJECT_MISSING);
  }
  if (!payload.sid || typeof payload.sid !== 'string') {
    return fail(TokenErrorCode.TOKEN_SESSION_ID_MISSING);
  }

  const aud = payload.aud;
  if (aud == null || aud === '') {
    return fail(TokenErrorCode.TOKEN_AUDIENCE_INVALID);
  }
  const audOk = Array.isArray(aud)
    ? aud.includes(expectedAudience)
    : aud === expectedAudience;
  if (!audOk) {
    return fail(TokenErrorCode.TOKEN_AUDIENCE_INVALID);
  }

  if (payload.azp == null || payload.azp === '') {
    return fail(TokenErrorCode.TOKEN_AUTHORIZED_PARTY_INVALID);
  }
  if (!azpAllowlist.includes(payload.azp)) {
    return fail(TokenErrorCode.TOKEN_AUTHORIZED_PARTY_INVALID);
  }

  const now = nowSeconds();
  if (typeof payload.exp !== 'number' || now >= payload.exp) {
    return fail(TokenErrorCode.TOKEN_EXPIRED);
  }
  if (typeof payload.nbf === 'number' && now < payload.nbf) {
    return fail(TokenErrorCode.TOKEN_NOT_YET_VALID);
  }
  if (typeof payload.iat !== 'number') {
    return fail(TokenErrorCode.TOKEN_MALFORMED, 'IAT_REQUIRED');
  }
  if (payload.iat > now + IAT_FUTURE_SKEW_SECONDS) {
    return fail(TokenErrorCode.TOKEN_IAT_IN_FUTURE);
  }

  const identityResult = createExternalProviderIdentity({
    provider: IdentityProvider.CLERK,
    issuer: payload.iss,
    subject: payload.sub,
    sessionId: payload.sid,
    issuedAt: payload.iat,
    notBefore: payload.nbf,
    expiresAt: payload.exp,
    authorizedParty: payload.azp,
    audience: payload.aud,
    authenticationEvidence: payload.amr || payload.authentication_method || null,
    tokenIdOptional: payload.jti || null,
  });
  if (!identityResult.ok) {
    return fail(identityResult.code);
  }

  return {
    ok: true,
    identity: identityResult.identity,
    header: Object.freeze({ alg: header.alg, kid: header.kid, typ: header.typ }),
  };
}
