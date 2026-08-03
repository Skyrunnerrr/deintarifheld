/**
 * P4-H0b2b/H0b4 — validate live Clerk Development session via remote JWKS
 * and enforce local session lifecycle (REVOKE_OLD_ALLOW_NEW).
 * Includes H0b4 failure-diagnostic hashed fingerprints (no raw claims).
 */
import {
  createRemoteJwksAdapter,
  createInMemoryPersonMappingAdapter,
  validateProviderToken,
  EXPECTED_AUDIENCE,
  DEVELOPMENT_AUTHORIZED_PARTY,
  AUTHORIZED_PARTY_ALLOWLIST,
  IdentityProvider,
  createInMemoryProviderSessionRegistry,
  applyProviderSessionLifecycle,
  CONCURRENT_SESSION_POLICY,
} from '@deintarifheld/shared';
import {
  emitSanitizedDiagnosticEvent,
  fingerprintSession,
  fingerprintSubject,
} from './h0b4-diagnostic.js';

export const DEVELOPMENT_CLERK_ISSUER = 'https://sterling-husky-22.clerk.accounts.dev';
export const DEVELOPMENT_CLERK_JWKS_URL =
  'https://sterling-husky-22.clerk.accounts.dev/.well-known/jwks.json';
export const DEVELOPMENT_CLERK_FAPI_ORIGIN = 'https://sterling-husky-22.clerk.accounts.dev';

/** Process-local registry for local CC H0b4 concurrent/revoke proofs. */
const defaultProviderSessionRegistry = createInMemoryProviderSessionRegistry();

/** Empty mapping — unknown real subjects must be rejected before DTH AuthZ. */
export function createEmptyPersonMappingAdapter() {
  return createInMemoryPersonMappingAdapter([]);
}

export function getDefaultProviderSessionRegistry() {
  return defaultProviderSessionRegistry;
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
    sessionLifecycleOk: Boolean(partial.sessionLifecycleOk),
    concurrentSessionPolicy: CONCURRENT_SESSION_POLICY,
    activeSessionCount: Number(partial.activeSessionCount || 0),
    priorSessionRevokedCount: Number(partial.priorSessionRevokedCount || 0),
    code: partial.code || null,
    issuerHost: 'sterling-husky-22.clerk.accounts.dev',
    jwksPath: '/.well-known/jwks.json',
    audience: EXPECTED_AUDIENCE,
    authorizedPartyPolicy: DEVELOPMENT_AUTHORIZED_PARTY,
    tokenBodyPresent: false,
    rawClaimsPresent: false,
    // H0b4 diagnostic fields (hashed only)
    diagnostic: partial.diagnostic || null,
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
 */
export async function validateLiveProviderSession({
  authorizationHeader,
  jwksAdapter,
  mappingAdapter = createEmptyPersonMappingAdapter(),
  sessionRegistry = defaultProviderSessionRegistry,
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
      diagnostic: emitSanitizedDiagnosticEvent({
        validationDecision: 'FAIL',
        denialReason: 'MISSING_AUTHORIZATION',
        h0b4ControllerReached: false,
      }),
    });
  }

  const m = authorizationHeader.match(/^Bearer\s+(\S+)\s*$/i);
  if (!m) {
    return redactedResult({
      liveProviderAuthentication: 'FAIL',
      liveTokenReceivedTransiently: false,
      code: 'AUTHORIZATION_SCHEME_REJECTED',
      dthAuthorization: 'DENIED',
      diagnostic: emitSanitizedDiagnosticEvent({
        validationDecision: 'FAIL',
        denialReason: 'AUTHORIZATION_SCHEME_REJECTED',
        h0b4ControllerReached: false,
      }),
    });
  }

  const token = m[1];
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
      diagnostic: emitSanitizedDiagnosticEvent({
        validationDecision: 'FAIL',
        denialReason: validated.code,
        h0b4ControllerReached: false,
      }),
    });
  }

  const identity = validated.identity;
  const providerOk = identity && identity.provider === IdentityProvider.CLERK;

  const registrySizeBefore = typeof sessionRegistry.size === 'function' ? sessionRegistry.size() : 0;
  const priorRecord = sessionRegistry.get(identity);
  const priorActiveSessionId = priorRecord?.activeSessionId || null;
  const priorActiveSessionPresent = Boolean(priorActiveSessionId);
  const priorSessionFingerprint = priorActiveSessionId
    ? fingerprintSession(priorActiveSessionId)
    : null;
  const sessionFingerprint = fingerprintSession(identity.sessionId);
  const subjectFingerprint = fingerprintSubject(identity.subject);
  const newSessionDifferentFromPrior = Boolean(
    priorActiveSessionId && priorActiveSessionId !== identity.sessionId,
  );

  const lifecycle = applyProviderSessionLifecycle({
    identity,
    registry: sessionRegistry,
    nowSeconds,
  });

  const registrySizeAfter = typeof sessionRegistry.size === 'function' ? sessionRegistry.size() : 0;
  const priorSessionMarkedRevoked = Boolean(
    lifecycle.ok && (lifecycle.revokedSessionIds || []).length > 0,
  );
  const afterRecord = sessionRegistry.get(identity);
  const currentActiveSessionFingerprint = afterRecord?.activeSessionId
    ? fingerprintSession(afterRecord.activeSessionId)
    : null;

  if (!lifecycle.ok) {
    const diagnostic = emitSanitizedDiagnosticEvent({
      subjectFingerprint,
      sessionFingerprint,
      registrySizeBefore,
      priorActiveSessionPresent,
      priorSessionFingerprint,
      newSessionDifferentFromPrior,
      priorSessionMarkedRevoked: priorRecord?.revokedSessionIds?.has(identity.sessionId) || false,
      registrySizeAfter,
      currentActiveSessionFingerprint,
      validationDecision: 'FAIL',
      denialReason: lifecycle.code,
      h0b4ControllerReached: true,
    });
    return redactedResult({
      liveProviderAuthentication: 'FAIL',
      liveTokenReceivedTransiently: true,
      liveTokenSignatureValid: true,
      liveTokenIssuerValid: true,
      liveTokenAudienceValid: true,
      liveTokenAuthorizedPartyValid: true,
      liveTokenExpiryValid: true,
      liveTokenRequiredClaimsValid: true,
      remoteDevelopmentJwksUsed: true,
      externalProviderIdentityCreated: Boolean(providerOk && identity),
      unknownRealSubjectRejected: true,
      sessionLifecycleOk: false,
      activeSessionCount: sessionRegistry.activeCount(identity),
      code: lifecycle.code,
      dthAuthorization: 'DENIED',
      diagnostic,
    });
  }

  const mapped = mappingAdapter.resolve({
    provider: identity.provider,
    issuer: identity.issuer,
    subject: identity.subject,
  });

  const unknownRejected = !mapped.ok;
  const diagnostic = emitSanitizedDiagnosticEvent({
    subjectFingerprint,
    sessionFingerprint,
    registrySizeBefore,
    priorActiveSessionPresent,
    priorSessionFingerprint,
    newSessionDifferentFromPrior,
    priorSessionMarkedRevoked,
    registrySizeAfter,
    currentActiveSessionFingerprint,
    validationDecision: providerOk ? 'PASS' : 'FAIL',
    denialReason: mapped.ok ? 'UNEXPECTED_MAPPING_PRESENT' : mapped.code || 'IDENTITY_MAPPING_NOT_FOUND',
    h0b4ControllerReached: true,
  });

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
    sessionLifecycleOk: true,
    activeSessionCount: lifecycle.activeSessionCount,
    priorSessionRevokedCount: (lifecycle.revokedSessionIds || []).length,
    code: mapped.ok ? 'UNEXPECTED_MAPPING_PRESENT' : mapped.code || 'IDENTITY_MAPPING_NOT_FOUND',
    diagnostic,
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
