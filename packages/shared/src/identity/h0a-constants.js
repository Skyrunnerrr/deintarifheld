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

/** Production audience value is not frozen — inject per environment/tests. */
export const PRODUCTION_AUDIENCE_VALUE_DEFINED = false;

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
