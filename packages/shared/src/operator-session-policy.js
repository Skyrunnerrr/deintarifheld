/**
 * OD-A11-SESSION-POLICY — approved for M11N implementation.
 * Timing values reuse existing H0a conservative operator session constants.
 * Hosted Supabase JWT expiry / refresh rotation remain HOSTED_CONFIG_REQUIRED.
 */
import {
  SESSION_INACTIVITY_TIMEOUT_MINUTES,
  SESSION_MAXIMUM_LIFETIME_HOURS,
  MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
  MULTI_SESSION_ALLOWED,
} from './identity/h0a-constants.js';

export const OperatorAuthMode = Object.freeze({
  LOCAL_TEST: 'local_test',
  HOSTED: 'hosted',
});

export const OperatorAssuranceLevel = Object.freeze({
  AAL1: 'aal1',
  AAL2: 'aal2',
});

export const OPERATOR_SESSION_POLICY_V1 = Object.freeze({
  decisionId: 'OD-A11-SESSION-POLICY',
  status: 'APPROVED_FOR_M11N_IMPLEMENTATION',
  authProvider: 'SUPABASE_AUTH',
  operatorAccess: 'INVITE_ONLY',
  primaryAuth: 'EMAIL_PASSWORD',
  mfa: 'TOTP_REQUIRED',
  minimumAssurance: OperatorAssuranceLevel.AAL2,
  publicOperatorSignup: 'DISABLED',
  socialOperatorLogin: 'DISABLED_V1',
  magicLinkOperatorLogin: 'DISABLED_V1',
  smsMfa: 'DISABLED_V1',
  authenticationAuthority: 'SUPABASE_AUTH',
  authorizationAuthority: 'DTH_SERVER_CAPABILITY_MODEL',
  sessionTransport: 'SERVER_VERIFIED_SESSION',
  cookieModel: 'HTTPONLY_SECURE_HOSTED_WHERE_SUPPORTED',
  localStorageAuthority: 'NONE',
  browserClaimsAuthority: 'NONE',
  inactivityTimeoutMinutes: SESSION_INACTIVITY_TIMEOUT_MINUTES,
  maximumLifetimeHours: SESSION_MAXIMUM_LIFETIME_HOURS,
  maxActiveSessionsPerOperator: MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
  multiSessionAllowed: MULTI_SESSION_ALLOWED,
  singleSessionEnforcement: 'PREFERRED_V1_IF_PROVIDER_SUPPORTS',
  refreshTokenRotation: 'PROVIDER_SUPPORTED_HOSTED_CONFIG_REQUIRED',
  failClosed: true,
  testIdentitiesInHosted: 'DENY',
  timingProvenance: 'REUSED_H0A_CONSERVATIVE_CONSTANTS',
  jwtExpiryHostedConfig: 'HOSTED_CONFIG_REQUIRED',
});

export const HostedAuthErrorCode = Object.freeze({
  AUTH_SESSION_MISSING: 'AUTH_SESSION_MISSING',
  AUTH_SESSION_INVALID: 'AUTH_SESSION_INVALID',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_PROVIDER_UNAVAILABLE: 'AUTH_PROVIDER_UNAVAILABLE',
  MFA_REQUIRED: 'MFA_REQUIRED',
  AAL2_REQUIRED: 'AAL2_REQUIRED',
  OPERATOR_NOT_PROVISIONED: 'OPERATOR_NOT_PROVISIONED',
  OPERATOR_DISABLED: 'OPERATOR_DISABLED',
  AUTHORITY_UNAVAILABLE: 'AUTHORITY_UNAVAILABLE',
  TEST_IDENTITY_HOSTED_DENIED: 'TEST_IDENTITY_HOSTED_DENIED',
  CLIENT_IDENTITY_REJECTED: 'CLIENT_IDENTITY_REJECTED',
  METADATA_IDENTITY_REJECTED: 'METADATA_IDENTITY_REJECTED',
  DISALLOWED_LOGIN_METHOD: 'DISALLOWED_LOGIN_METHOD',
  AUTH_OPEN_REDIRECT: 'AUTH_OPEN_REDIRECT',
  AUTH_MODE_INVALID: 'AUTH_MODE_INVALID',
});

export function resolveOperatorAuthMode(env = process.env) {
  const raw = String(env.DTH_AUTH_MODE || env.DTH_OPERATOR_AUTH_MODE || '').trim().toLowerCase();
  if (raw === OperatorAuthMode.HOSTED || raw === 'production' || raw === 'staging') {
    return OperatorAuthMode.HOSTED;
  }
  if (raw === OperatorAuthMode.LOCAL_TEST || raw === 'test' || raw === 'local') {
    return OperatorAuthMode.LOCAL_TEST;
  }
  // Fail closed for ambiguous production-like NODE_ENV without explicit local_test.
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
    return OperatorAuthMode.HOSTED;
  }
  if (env.DTH_LOCAL_AUTH_ENABLED === 'true') {
    return OperatorAuthMode.LOCAL_TEST;
  }
  return OperatorAuthMode.LOCAL_TEST;
}

export function isSafeAuthRedirectPath(returnTo) {
  if (returnTo == null || returnTo === '') return true;
  if (typeof returnTo !== 'string') return false;
  if (!returnTo.startsWith('/')) return false;
  if (returnTo.startsWith('//')) return false;
  if (returnTo.includes('://')) return false;
  if (returnTo.includes('\\')) return false;
  return true;
}
