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

/* DTH-A1 durable workflow runtime contracts */
export {
  JOB_DELIVERY_SEMANTICS,
  PRODUCTION_EXACTLY_ONCE_GUARANTEE,
  EXTERNAL_EFFECT_ADAPTER_DEFAULT,
  PRODUCTION_AUTONOMY_ALLOWED,
  WorkflowStatus,
  JobStatus,
  ControlScope,
  ControlStateValue,
  WorkflowErrorClass,
  RETRYABLE_ERROR_CLASSES,
  RECONCILIATION_ERROR_CLASSES,
  SyntheticCapability,
  A1_WORKFLOW_TYPE,
  A1_WORKFLOW_VERSION,
  A2_HANDOFF_EVENT_TYPE,
  RuntimeLimits,
  isRetryableErrorClass,
  requiresReconciliation,
} from './workflow-runtime-contracts.js';

/* DTH-A3 B2B qualification contracts */
export {
  A3_POLICY_ID,
  A3_POLICY_VERSION,
  QUALIFICATION_SCOPE,
  B2B_QUALIFICATION_REEVALUATE_CAPABILITY,
  QualificationOutcome,
  RequirementStatus,
  ObservationSourceKind,
  FieldCode,
  OBSERVATION_FIELD_ALLOWLIST,
  ReasonCode,
  FieldRequirementClass,
  CanonicalEnergyType,
  WorkflowQualState,
  isObservationFieldAllowed,
  workflowStateForOutcome,
} from './a3-qualification-contracts.js';

/* DTH-A2 Lead → Case contracts */
export {
  BUSINESS_LEAD_ACCEPTED_EVENT,
  BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION,
  B2B_INBOUND_WORKFLOW_TYPE,
  B2B_INBOUND_WORKFLOW_VERSION,
  B2B_QUALIFICATION_START_CAPABILITY,
  LeadType,
  SOURCE_LEAD_STATUS_AFTER_ACCEPT,
  CASE_INITIAL_STATUS,
  WORKFLOW_INITIAL_STATE,
  FIRST_JOB_TYPE,
  buildBusinessLeadAcceptedPayload,
  isBusinessEnergyLeadType,
} from './a2-lead-case-contracts.js';

/* P4-H0a — local production-identity foundation (synthetic provider evidence) */
export {
  IdentityProvider,
  PRODUCTION_CC_ORIGIN,
  PRODUCTION_AUTH_UI_ORIGIN,
  PASSKEY_RP_ID,
  EXPECTED_AUTHORIZED_PARTY,
  EXPECTED_AUDIENCE,
  PRODUCTION_AUDIENCE_VALUE_DEFINED,
  DEVELOPMENT_AUTHORIZED_PARTY,
  LOCAL_CC_ORIGIN,
  AUTHORIZED_PARTY_ALLOWLIST,
  AUTHORIZED_PARTY_WILDCARDS_ALLOWED,
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
export {
  deriveDevelopmentJwksEndpoints,
  validateExactDevelopmentJwksUrl,
} from './identity/jwks-url-policy.js';
export {
  createRemoteJwksAdapter,
  parseAndValidateJwks,
  JWKS_CACHE_TTL_SECONDS,
  JWKS_TOTAL_TIMEOUT_MILLISECONDS,
  JWKS_MAX_RESPONSE_BYTES,
  JWKS_MAX_KEYS,
  UNKNOWN_KID_FORCED_REFRESH_COUNT,
  AUTOMATIC_RETRY_COUNT,
  STALE_JWKS_AFTER_TTL_ALLOWED,
  REDIRECTS_ALLOWED,
} from './identity/remote-jwks-adapter.js';
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
  CONCURRENT_SESSION_POLICY,
} from './identity/session-policy.js';
export {
  createInMemoryProviderSessionRegistry,
  applyProviderSessionLifecycle,
  markProviderSessionRevoked,
} from './identity/provider-session-lifecycle.js';
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
