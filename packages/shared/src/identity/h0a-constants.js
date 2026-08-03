/**
 * P4-H0a frozen security policy constants (contracts only — not live Clerk enforcement).
 */

export const IdentityProvider = Object.freeze({
  CLERK: 'CLERK',
});

export const PRODUCTION_CC_ORIGIN = 'https://cc.deintarifheld.de';
export const PRODUCTION_AUTH_UI_ORIGIN = 'https://cc.deintarifheld.de';
export const PASSKEY_RP_ID = 'cc.deintarifheld.de';
export const EXPECTED_AUTHORIZED_PARTY = 'https://cc.deintarifheld.de';

/**
 * P4-H0b2a Owner-decided audience for Ops/CC provider tokens.
 * Configured as Clerk custom session-token claim `aud` in Development.
 */
export const EXPECTED_AUDIENCE = 'urn:deintarifheld:ops-api';
export const PRODUCTION_AUDIENCE_VALUE_DEFINED = true;

/**
 * Exact azp allowlist — no wildcards.
 * Development local CC origin must be localhost (not 127.0.0.1) so WebAuthn/passkeys
 * can use a valid RP ID hostname. Production azp remains cc.deintarifheld.de.
 */
export const DEVELOPMENT_AUTHORIZED_PARTY = 'http://localhost:3100';
export const LOCAL_CC_ORIGIN = DEVELOPMENT_AUTHORIZED_PARTY;
export const AUTHORIZED_PARTY_ALLOWLIST = Object.freeze([
  DEVELOPMENT_AUTHORIZED_PARTY,
  EXPECTED_AUTHORIZED_PARTY,
]);
export const AUTHORIZED_PARTY_WILDCARDS_ALLOWED = false;

export const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;
export const SESSION_MAXIMUM_LIFETIME_HOURS = 12;
export const MAX_ACTIVE_SESSIONS_PER_DTH_PERSON = 1;
export const MULTI_SESSION_ALLOWED = false;

export const LinkStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
});

export const PasskeyPolicy = Object.freeze({
  PRIMARY_SIGN_IN: true,
  REQUIRED_BEFORE_CC_ACCESS: true,
  PUBLIC_SELF_REGISTRATION_ALLOWED: false,
  SIGNUP_MODE: 'RESTRICTED_INVITATION_ONLY',
  EMAIL_OTP_NORMAL_OPERATIONAL_SIGN_IN_ALLOWED: false,
  PASSKEY_POLICY_LIVE_VALIDATED: false,
  CLERK_PASSKEY_ENFORCEMENT_PROVEN: false,
});

export const AuthAssuranceMethod = Object.freeze({
  PASSKEY: 'PASSKEY',
  EMAIL_OTP_ENROLLMENT: 'EMAIL_OTP_ENROLLMENT',
  EMAIL_OTP_RECOVERY: 'EMAIL_OTP_RECOVERY',
  SYNTHETIC_TEST: 'SYNTHETIC_TEST',
});
