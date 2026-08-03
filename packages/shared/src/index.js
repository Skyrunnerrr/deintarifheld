/** @deintarifheld/shared — P3-F0/F1/F6 foundation exports */
export { DTH_PACKAGE_SKELETON } from './skeleton.js';
export {
  PrincipalType,
  createPersonPrincipal,
  createServicePrincipal,
  createBreakGlassPrincipal,
  isPersonPrincipal,
} from './principal.js';
export { issueCcSession, rejectSharedSecretAsCcSession } from './session.js';
export { auditActorFromCcSession } from './audit-actor.js';
export {
  KillDomain,
  KILL_DOMAINS,
  KILL_DOMAIN_COUNT,
  isKillDomain,
  assertExactKillDomainSet,
} from './kill-domains.js';
export { KillState, isKillState, evaluateCapabilityEnabled } from './kill-state.js';
export { LOCAL_DEV_KILL_DEFAULTS, createDefaultKillRegistry } from './kill-defaults.js';
export {
  SotResourceType,
  SotPersistenceTarget,
  SOT_ALIAS_MAP,
  COMMUNICATION_EVENT_SOT_TYPE,
  CASE_NOTE_SOT_TYPE,
  resolveSotAlias,
} from './sot-alias.js';
export {
  CcPrimaryView,
  InboxRequestKind,
  InboxAssignmentStatus,
  redactEmail,
  buildInboxItemFromLead,
  buildInboxItemFromCareer,
} from './cc-read-models.js';
export {
  SYNTHETIC_NOOP_EVENT_TYPE,
  SYNTHETIC_NOOP_PAYLOAD,
  isAuthorizedSyntheticNoopEvent,
} from './synthetic-noop.js';
export {
  AutomationActivation,
  LOCAL_TEST_FLAG_NAME,
  PersistenceAdapterKind,
  ExternalEffectAdapterKind,
  resolveAutomationActivation,
  resolveLocalTestFlag,
  evaluateWorkerMayProcess,
} from './worker-activation.js';
export {
  WorkerRunResultCode,
  WorkerErrorClass,
  MAX_JOBS_PER_TEST_RUN,
} from './outbox-consumer-contracts.js';

/* P4-H0a — local production-identity foundation (synthetic provider evidence) */
export {
  IdentityProvider,
  PRODUCTION_CC_ORIGIN,
  PRODUCTION_AUTH_UI_ORIGIN,
  PASSKEY_RP_ID,
  EXPECTED_AUTHORIZED_PARTY,
  PRODUCTION_AUDIENCE_VALUE_DEFINED,
  SESSION_INACTIVITY_TIMEOUT_MINUTES,
  SESSION_MAXIMUM_LIFETIME_HOURS,
  MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
  MULTI_SESSION_ALLOWED,
  LinkStatus,
  PasskeyPolicy,
  AuthAssuranceMethod,
} from './identity/h0a-constants.js';
export { TokenErrorCode } from './identity/token-errors.js';
export { createStaticJwksAdapter } from './identity/jwks-adapter.js';
export { validateProviderToken } from './identity/token-validator.js';
export {
  createInMemoryPersonMappingAdapter,
  rejectEmailBasedAutoMapping,
  rejectAutomaticPersonCreation,
} from './identity/person-mapping.js';
export {
  createInMemoryActiveSessionAdapter,
  evaluateSessionPolicy,
  PRODUCTION_CONCURRENT_SESSION_RESOLUTION,
} from './identity/session-policy.js';
export {
  getPasskeyEnrollmentPolicyContract,
  evaluateOperationalPasskeyAssurance,
} from './identity/passkey-policy.js';
export {
  authenticateProviderTokenToPersonPrincipal,
  rejectNonPersonAsPersonSession,
} from './identity/authenticate-provider-token.js';
export {
  createEphemeralRs256TestFixture,
  SYNTHETIC_ISSUER,
  SYNTHETIC_AUDIENCE,
} from './identity/synthetic-test-keys.js';
