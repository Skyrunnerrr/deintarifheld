/**
 * M11N — hosted Supabase operator session verification (server-side).
 * Authentication authority: Supabase Auth. Authorization remains M11H→M11I→M11J.
 * Inject provider adapters for tests; never trust browser claims/AAL/user id.
 */
import {
  HostedAuthErrorCode,
  OperatorAssuranceLevel,
  OperatorAuthMode,
  OPERATOR_SESSION_POLICY_V1,
  isSafeAuthRedirectPath,
  resolveOperatorAuthMode,
} from '@deintarifheld/shared';
import {
  resolveOperatorByVerifiedAuthSubject,
  OperatorIdentityResolutionCode,
  rejectClientOperatorIdentity,
  rejectMetadataOperatorAuthority,
} from '@deintarifheld/db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deny(code, status = 401, extra = {}) {
  return { ok: false, status, code, ...extra };
}

/**
 * Extract bearer access token from Authorization header.
 * Does not accept body/query tokens.
 */
export function extractBearerAccessToken(headers = {}) {
  const raw =
    headers.authorization ||
    headers.Authorization ||
    headers.AUTHORIZATION ||
    '';
  const m = String(raw).match(/^Bearer\s+(\S+)\s*$/i);
  return m ? m[1] : null;
}

/**
 * Reject obviously unsafe logging of auth material.
 */
export function sanitizeAuthLogValue(value) {
  if (value == null) return value;
  const s = String(value);
  if (s.length > 24 && /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\./.test(s)) {
    return '[REDACTED_JWT]';
  }
  if (/refresh_token|access_token|Bearer\s+\S+/i.test(s)) {
    return '[REDACTED_AUTH]';
  }
  return s;
}

/**
 * Normalize provider AAL evidence. Client-supplied aal is ignored by callers.
 */
export function normalizeAssuranceLevel(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'aal2' || v === '2') return OperatorAssuranceLevel.AAL2;
  if (v === 'aal1' || v === '1') return OperatorAssuranceLevel.AAL1;
  return null;
}

/**
 * @param {object} input
 * @param {string|null} input.accessToken — server-extracted bearer/cookie access token
 * @param {Function} input.getUser — async (jwt) => { data:{user}, error }
 * @param {Function} [input.getAuthenticatorAssuranceLevel] — async (jwt) => { currentLevel, nextLevel, error }
 * @param {object} [input.env]
 * @param {string} [input.clientClaimedAal] — ignored; spoof probe
 * @param {string} [input.clientAuthUserId] — ignored; spoof probe
 * @param {object} [input.clientUserMetadata] — ignored for authority
 */
export async function verifyHostedSupabaseSession(input = {}) {
  const {
    accessToken,
    getUser,
    getAuthenticatorAssuranceLevel,
    env = process.env,
    clientClaimedAal,
    clientAuthUserId,
    clientUserMetadata,
    clientEmail,
  } = input;

  const mode = resolveOperatorAuthMode(env);
  if (mode !== OperatorAuthMode.HOSTED) {
    return deny(HostedAuthErrorCode.AUTH_MODE_INVALID, 403, {
      authMode: mode,
      policy: OPERATOR_SESSION_POLICY_V1.decisionId,
    });
  }

  const clientReject = rejectClientOperatorIdentity({
    clientAuthUserId: clientAuthUserId || null,
  });
  if (!clientReject.ok) {
    return deny(HostedAuthErrorCode.CLIENT_IDENTITY_REJECTED, 403);
  }
  const metaReject = rejectMetadataOperatorAuthority({
    email: clientEmail,
    userMetadata: clientUserMetadata,
  });
  if (!metaReject.ok) {
    // Spoofed metadata must not grant authority; continue only if we still verify server session.
    // If ONLY metadata is present without token, deny.
    if (!accessToken) {
      return deny(HostedAuthErrorCode.METADATA_IDENTITY_REJECTED, 403);
    }
  }

  // Client AAL claim is never authoritative (probe only).
  void clientClaimedAal;

  if (!accessToken) {
    return deny(HostedAuthErrorCode.AUTH_SESSION_MISSING);
  }

  if (typeof getUser !== 'function') {
    return deny(HostedAuthErrorCode.AUTH_PROVIDER_UNAVAILABLE, 503);
  }

  let userResult;
  try {
    userResult = await getUser(accessToken);
  } catch {
    return deny(HostedAuthErrorCode.AUTH_PROVIDER_UNAVAILABLE, 503);
  }

  if (userResult?.error) {
    const msg = String(userResult.error.message || userResult.error || '').toLowerCase();
    if (msg.includes('expired')) {
      return deny(HostedAuthErrorCode.AUTH_SESSION_EXPIRED);
    }
    return deny(HostedAuthErrorCode.AUTH_SESSION_INVALID);
  }

  const user = userResult?.data?.user || userResult?.user || null;
  if (!user?.id || !UUID_RE.test(String(user.id))) {
    return deny(HostedAuthErrorCode.AUTH_SESSION_INVALID);
  }

  let aal = null;
  if (typeof getAuthenticatorAssuranceLevel === 'function') {
    try {
      const aalResult = await getAuthenticatorAssuranceLevel(accessToken);
      if (aalResult?.error) {
        return deny(HostedAuthErrorCode.AUTH_PROVIDER_UNAVAILABLE, 503);
      }
      aal = normalizeAssuranceLevel(
        aalResult?.currentLevel || aalResult?.data?.currentLevel || aalResult?.aal,
      );
    } catch {
      return deny(HostedAuthErrorCode.AUTH_PROVIDER_UNAVAILABLE, 503);
    }
  } else if (user.app_metadata?.aal || user.aal) {
    // Only accepted when returned by provider user payload from getUser — not from client body.
    aal = normalizeAssuranceLevel(user.app_metadata?.aal || user.aal);
  }

  if (aal !== OperatorAssuranceLevel.AAL2) {
    return deny(HostedAuthErrorCode.AAL2_REQUIRED, 401, {
      aal: aal || OperatorAssuranceLevel.AAL1,
      mfa: HostedAuthErrorCode.MFA_REQUIRED,
    });
  }

  return {
    ok: true,
    code: 'AAL2_VERIFIED',
    authUserId: String(user.id),
    aal: OperatorAssuranceLevel.AAL2,
    email: typeof user.email === 'string' ? user.email : null,
    authMode: OperatorAuthMode.HOSTED,
    policy: OPERATOR_SESSION_POLICY_V1.decisionId,
  };
}

/**
 * Map verified hosted session → M11H operator identity (fail closed).
 */
export async function resolveHostedOperatorFromSession(pool, verifiedSession) {
  if (!verifiedSession?.ok || !verifiedSession.authUserId) {
    return deny(HostedAuthErrorCode.AUTH_SESSION_INVALID);
  }

  const resolved = await resolveOperatorByVerifiedAuthSubject(pool, {
    verifiedAuthUserId: verifiedSession.authUserId,
  });

  if (!resolved.ok) {
    if (resolved.code === OperatorIdentityResolutionCode.NOT_PROVISIONED) {
      return deny(HostedAuthErrorCode.OPERATOR_NOT_PROVISIONED, 403);
    }
    if (resolved.code === OperatorIdentityResolutionCode.DISABLED) {
      return deny(HostedAuthErrorCode.OPERATOR_DISABLED, 403);
    }
    if (resolved.code === OperatorIdentityResolutionCode.DATA_UNAVAILABLE) {
      return deny(HostedAuthErrorCode.AUTHORITY_UNAVAILABLE, 503);
    }
    return deny(HostedAuthErrorCode.OPERATOR_NOT_PROVISIONED, 403);
  }

  return {
    ok: true,
    code: 'HOSTED_OPERATOR_RESOLVED',
    authUserId: verifiedSession.authUserId,
    operatorId: resolved.operatorId,
    aal: verifiedSession.aal,
    identitySource: 'SUPABASE_AUTH_M11H',
    productionIdentity: true,
    authMode: OperatorAuthMode.HOSTED,
  };
}

/**
 * Full hosted gate: verify session + AAL2 + M11H mapping.
 * Does not authorize capabilities (M11J remains separate).
 */
export async function gateHostedA11Request({
  pool,
  headers,
  accessToken,
  getUser,
  getAuthenticatorAssuranceLevel,
  env = process.env,
  body = {},
  query = {},
} = {}) {
  const mode = resolveOperatorAuthMode(env);
  if (mode === OperatorAuthMode.LOCAL_TEST) {
    return deny(HostedAuthErrorCode.AUTH_MODE_INVALID, 403, {
      hint: 'gateHostedA11Request requires hosted auth mode',
    });
  }

  const token = accessToken || extractBearerAccessToken(headers || {});
  const verified = await verifyHostedSupabaseSession({
    accessToken: token,
    getUser,
    getAuthenticatorAssuranceLevel,
    env,
    clientClaimedAal: body.aal || query.aal || body.assuranceLevel,
    clientAuthUserId: body.authUserId || body.userId || query.authUserId,
    clientUserMetadata: body.user_metadata || body.userMetadata,
    clientEmail: body.email || query.email,
  });
  if (!verified.ok) return verified;

  const mapped = await resolveHostedOperatorFromSession(pool, verified);
  if (!mapped.ok) return mapped;

  return {
    ok: true,
    status: 200,
    code: 'HOSTED_A11_IDENTITY',
    actorType: 'PERSON',
    actorId: mapped.operatorId,
    operatorId: mapped.operatorId,
    authUserId: mapped.authUserId,
    aal: mapped.aal,
    identitySource: mapped.identitySource,
    productionIdentity: true,
    strongAuthzComplete: false,
    productionAuthzReady: false,
    currentLocalAuthzMode: 'A11_M11N_HOSTED_SESSION_GATE',
    authMode: OperatorAuthMode.HOSTED,
  };
}

/**
 * Hard deny TEST_* / local synthetic identities when hosted mode is active.
 */
export function denyTestIdentityInHostedMode({ env = process.env, identitySource, label, personId } = {}) {
  const mode = resolveOperatorAuthMode(env);
  if (mode !== OperatorAuthMode.HOSTED) {
    return { ok: true };
  }
  const src = String(identitySource || '');
  const lab = String(label || '');
  const pid = String(personId || '');
  if (
    src.includes('TEST') ||
    lab.startsWith('TEST_') ||
    pid.includes('person_synth_') ||
    pid.includes('TEST_')
  ) {
    return deny(HostedAuthErrorCode.TEST_IDENTITY_HOSTED_DENIED, 403);
  }
  return { ok: true };
}

export function assertSafeAuthRedirect(returnTo) {
  if (!isSafeAuthRedirectPath(returnTo)) {
    return deny(HostedAuthErrorCode.AUTH_OPEN_REDIRECT, 400);
  }
  return { ok: true, returnTo: returnTo || '/' };
}

export { OPERATOR_SESSION_POLICY_V1, HostedAuthErrorCode, OperatorAuthMode };
