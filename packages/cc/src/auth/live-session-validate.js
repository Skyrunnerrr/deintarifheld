/**
 * P4-H0b2b — validate a live Clerk Development session token via remote JWKS.
 * Server-trusted issuer/JWKS/aud/azp only. Never echo token or raw claims.
 */
import {
  createRemoteJwksAdapter,
  createInMemoryPersonMappingAdapter,
  validateProviderToken,
  EXPECTED_AUDIENCE,
  DEVELOPMENT_AUTHORIZED_PARTY,
  AUTHORIZED_PARTY_ALLOWLIST,
  IdentityProvider,
} from '@deintarifheld/shared';

export const DEVELOPMENT_CLERK_ISSUER = 'https://sterling-husky-22.clerk.accounts.dev';
export const DEVELOPMENT_CLERK_JWKS_URL =
  'https://sterling-husky-22.clerk.accounts.dev/.well-known/jwks.json';
export const DEVELOPMENT_CLERK_FAPI_ORIGIN = 'https://sterling-husky-22.clerk.accounts.dev';

/** Empty mapping — unknown real subjects must be rejected in H0b2b. */
export function createEmptyPersonMappingAdapter() {
  return createInMemoryPersonMappingAdapter([]);
}

/**
 * Build a remote JWKS adapter pinned to the accepted Development endpoints.
 * Issuer/JWKS/origin are not taken from the request.
 */
export function createDevelopmentRemoteJwksAdapter(overrides = {}) {
  return createRemoteJwksAdapter({
    expectedIssuer: DEVELOPMENT_CLERK_ISSUER,
    jwksUrl: DEVELOPMENT_CLERK_JWKS_URL,
    approvedFrontendApiOrigin: DEVELOPMENT_CLERK_FAPI_ORIGIN,
    ...overrides,
  });
}

function redactedResult(partial) {
  return Object.freeze({
    ok: false,
    liveProviderAuthentication: partial.liveProviderAuthentication || 'FAIL',
    liveTokenReceivedTransiently: Boolean(partial.liveTokenReceivedTransiently),
    liveTokenSignatureValid: Boolean(partial.liveTokenSignatureValid),
    liveTokenIssuerValid: Boolean(partial.liveTokenIssuerValid),
    liveTokenAudienceValid: Boolean(partial.liveTokenAudienceValid),
    liveTokenAuthorizedPartyValid: Boolean(partial.liveTokenAuthorizedPartyValid),
    liveTokenExpiryValid: Boolean(partial.liveTokenExpiryValid),
    liveTokenRequiredClaimsValid: Boolean(partial.liveTokenRequiredClaimsValid),
    remoteDevelopmentJwksUsed: Boolean(partial.remoteDevelopmentJwksUsed),
    externalProviderIdentityCreated: Boolean(partial.externalProviderIdentityCreated),
    realSubjectHasDthPersonMapping: false,
    unknownRealSubjectRejected: Boolean(partial.unknownRealSubjectRejected),
    dthAuthorization: partial.dthAuthorization || 'DENIED',
    operationalApiAccessAllowed: false,
    operationalWritesAllowed: false,
    code: partial.code || null,
    issuerHost: 'sterling-husky-22.clerk.accounts.dev',
    jwksPath: '/.well-known/jwks.json',
    audience: EXPECTED_AUDIENCE,
    authorizedPartyPolicy: DEVELOPMENT_AUTHORIZED_PARTY,
    // Explicit nondisclosure markers for evidence/UI
    tokenBodyPresent: false,
    rawClaimsPresent: false,
  });
}

function classifyValidationFailure(code) {
  const c = String(code || '');
  return {
    liveTokenSignatureValid: c !== 'TOKEN_SIGNATURE_INVALID' && c !== 'TOKEN_ALG_NONE_REJECTED',
    liveTokenIssuerValid: c !== 'TOKEN_ISSUER_INVALID',
    liveTokenAudienceValid: c !== 'TOKEN_AUDIENCE_INVALID',
    liveTokenAuthorizedPartyValid: c !== 'TOKEN_AUTHORIZED_PARTY_INVALID',
    liveTokenExpiryValid: c !== 'TOKEN_EXPIRED' && c !== 'TOKEN_NOT_YET_VALID',
    liveTokenRequiredClaimsValid: false,
  };
}

/**
 * Validate Bearer token from browser-managed Clerk session.
 * @param {object} opts
 * @param {string|null|undefined} opts.authorizationHeader
 * @param {object} [opts.jwksAdapter]
 * @param {object} [opts.mappingAdapter]
 * @param {() => number} [opts.nowSeconds]
 */
export async function validateLiveProviderSession({
  authorizationHeader,
  jwksAdapter,
  mappingAdapter = createEmptyPersonMappingAdapter(),
  nowSeconds = () => Math.floor(Date.now() / 1000),
  expectedIssuer = DEVELOPMENT_CLERK_ISSUER,
  expectedAudience = EXPECTED_AUDIENCE,
  expectedAuthorizedParty = AUTHORIZED_PARTY_ALLOWLIST,
} = {}) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return redactedResult({
      liveProviderAuthentication: 'FAIL',
      liveTokenReceivedTransiently: false,
      code: 'MISSING_AUTHORIZATION',
      dthAuthorization: 'DENIED',
    });
  }

  const m = authorizationHeader.match(/^Bearer\s+(\S+)\s*$/i);
  if (!m) {
    return redactedResult({
      liveProviderAuthentication: 'FAIL',
      liveTokenReceivedTransiently: false,
      code: 'AUTHORIZATION_SCHEME_REJECTED',
      dthAuthorization: 'DENIED',
    });
  }

  const token = m[1];
  // Do not retain token beyond this stack frame for any logging/response.
  const adapter = jwksAdapter || createDevelopmentRemoteJwksAdapter();

  const validated = await validateProviderToken({
    token,
    jwksAdapter: adapter,
    expectedIssuer,
    expectedAudience,
    expectedAuthorizedParty,
    nowSeconds,
  });

  if (!validated.ok) {
    const flags = classifyValidationFailure(validated.code);
    return redactedResult({
      liveProviderAuthentication: 'FAIL',
      liveTokenReceivedTransiently: true,
      remoteDevelopmentJwksUsed: true,
      ...flags,
      code: validated.code,
      dthAuthorization: 'DENIED',
    });
  }

  const identity = validated.identity;
  const providerOk = identity && identity.provider === IdentityProvider.CLERK;
  const mapped = mappingAdapter.resolve({
    provider: identity.provider,
    issuer: identity.issuer,
    subject: identity.subject,
  });

  const unknownRejected = !mapped.ok;
  // H0b2b success for AuthN is claim/JWKS validation + expected mapping denial.
  return redactedResult({
    liveProviderAuthentication: providerOk ? 'PASS' : 'FAIL',
    liveTokenReceivedTransiently: true,
    liveTokenSignatureValid: true,
    liveTokenIssuerValid: true,
    liveTokenAudienceValid: true,
    liveTokenAuthorizedPartyValid: true,
    liveTokenExpiryValid: true,
    liveTokenRequiredClaimsValid: Boolean(
      identity?.subject && identity?.sessionId && identity?.issuer,
    ),
    remoteDevelopmentJwksUsed: true,
    externalProviderIdentityCreated: Boolean(providerOk && identity),
    unknownRealSubjectRejected: unknownRejected,
    dthAuthorization: 'DENIED_EXPECTED',
    code: mapped.ok ? 'UNEXPECTED_MAPPING_PRESENT' : mapped.code || 'IDENTITY_MAPPING_NOT_FOUND',
  });
}

/**
 * Extract Authorization header without logging.
 * @param {import('node:http').IncomingMessage} req
 */
export function readAuthorizationHeader(req) {
  const h = req && req.headers ? req.headers.authorization : undefined;
  if (Array.isArray(h)) return h[0] || null;
  return h || null;
}
