/**
 * Hosted invite / recovery acceptance — server-controlled flow markers.
 * Never infer initial-password requirement from browser metadata or localStorage.
 */

export const HostedAuthFlowType = Object.freeze({
  INVITE: 'invite',
  RECOVERY: 'recovery',
});

export const HOSTED_AUTH_FLOW_COOKIE = 'dth_hosted_auth_flow';
export const HOSTED_PASSWORD_SET_COOKIE = 'dth_hosted_password_set';

export const SET_PASSWORD_PATH = '/command-center/set-password';
export const MFA_PATH = '/command-center/mfa';

/** Minimum aligned with hosted Supabase password policy (provider is authority). */
export const HOSTED_PASSWORD_MIN_LENGTH = 12;

const FLOW_COOKIE_MAX_AGE = 60 * 60; // 1h to complete password setup
const PASSWORD_SET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1y marker per browser

function isSafeAuthRedirectPath(returnTo) {
  if (returnTo == null || returnTo === '') return true;
  if (typeof returnTo !== 'string') return false;
  if (!returnTo.startsWith('/')) return false;
  if (returnTo.startsWith('//')) return false;
  if (returnTo.includes('://')) return false;
  if (returnTo.includes('\\')) return false;
  return true;
}

export function classifyAuthCallbackFlow({ typeParam, user } = {}) {
  const type = String(typeParam || '').toLowerCase();
  if (type === 'invite' || type === 'signup') {
    return HostedAuthFlowType.INVITE;
  }
  if (type === 'recovery') {
    return HostedAuthFlowType.RECOVERY;
  }
  if (user?.invited_at) {
    return HostedAuthFlowType.INVITE;
  }
  return null;
}

export function resolveSafeHostedRedirect(next, fallback = '/command-center/') {
  const candidate = next || fallback;
  if (!isSafeAuthRedirectPath(candidate)) {
    return fallback;
  }
  if (!candidate.startsWith('/command-center')) {
    return fallback;
  }
  return candidate;
}

export function passwordSetCookieMatchesUser(cookies, userId) {
  if (!userId) return false;
  const value = cookies?.get?.(HOSTED_PASSWORD_SET_COOKIE)?.value;
  return value === String(userId);
}

/**
 * Initial password required when callback established an invite/recovery flow
 * and this browser has not yet completed password setup for the current user.
 */
export function requiresInitialPasswordSetup(cookies, userId) {
  if (!userId) return false;
  if (passwordSetCookieMatchesUser(cookies, userId)) {
    return false;
  }
  const flow = cookies?.get?.(HOSTED_AUTH_FLOW_COOKIE)?.value;
  return flow === HostedAuthFlowType.INVITE || flow === HostedAuthFlowType.RECOVERY;
}

export function hostedAuthFlowCookieOptions(flowType) {
  return {
    name: HOSTED_AUTH_FLOW_COOKIE,
    value: flowType,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: FLOW_COOKIE_MAX_AGE,
  };
}

export function hostedPasswordSetCookieOptions(userId) {
  return {
    name: HOSTED_PASSWORD_SET_COOKIE,
    value: String(userId),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PASSWORD_SET_COOKIE_MAX_AGE,
  };
}

export function clearHostedAuthFlowCookieOptions() {
  return {
    name: HOSTED_AUTH_FLOW_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
}

export function validatePasswordSetupInput({ password, confirmPassword } = {}) {
  const pwd = String(password || '');
  const confirm = String(confirmPassword || '');
  if (!pwd || !confirm) {
    return { ok: false, code: 'PASSWORD_REQUIRED' };
  }
  if (pwd !== confirm) {
    return { ok: false, code: 'PASSWORD_MISMATCH' };
  }
  if (pwd.length < HOSTED_PASSWORD_MIN_LENGTH) {
    return { ok: false, code: 'PASSWORD_TOO_SHORT' };
  }
  return { ok: true };
}

export function resolvePostCallbackRedirect({ flowType, next, userId, cookies }) {
  const safeNext = resolveSafeHostedRedirect(next);
  if (!flowType) {
    return safeNext;
  }
  if (passwordSetCookieMatchesUser(cookies, userId)) {
    return safeNext;
  }
  return SET_PASSWORD_PATH;
}
