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

/* DTH-A4 Communication Engine contracts */
export {
  A4_COMMUNICATION_POLICY_ID,
  A4_COMMUNICATION_POLICY_VERSION,
  A4_TEMPLATE_MISSING_INFO_ID,
  A4_TEMPLATE_MISSING_INFO_VERSION,
  A4_TEST_FOLLOWUP_DELAY_MS,
  A4_DEFAULT_MAX_FOLLOWUPS,
  OWNER_FOLLOWUP_CADENCE_REQUIRED,
  B2B_MISSING_INFO_COMMUNICATE_CAPABILITY,
  B2B_COMMUNICATION_SEND_CAPABILITY,
  B2B_MISSING_INFO_FOLLOWUP_CAPABILITY,
  B2B_INBOUND_EMAIL_PROCESS_CAPABILITY,
  B2B_APPOINTMENT_OFFER_PREPARE_CAPABILITY,
  MessagePurpose,
  ALLOWED_MESSAGE_PURPOSES,
  APPOINTMENT_MESSAGE_PURPOSES,
  OutboundIntentState,
  ConversationStatus,
  InboundEventStatus,
  FollowupStatus,
  FIELD_LABEL_DE,
  isAllowedMessagePurpose,
  isAppointmentMessagePurpose,
  PROVIDER_EVENT_PRECEDENCE,
} from './a4-communication-contracts.js';

/* DTH-A5 Calendar + Appointment contracts */
export {
  A5_APPOINTMENT_POLICY_ID,
  A5_APPOINTMENT_POLICY_VERSION,
  A5_CALENDAR_RESOURCE_DEFAULT,
  A5_PROVIDER_TEST,
  AppointmentPurpose,
  ALLOWED_APPOINTMENT_PURPOSES,
  BookingSessionStatus,
  AppointmentStatus,
  ConferenceStatus,
  ReminderStatus,
  APPOINTMENT_OFFER_PREPARE_CAPABILITY,
  APPOINTMENT_BOOK_SELECTED_SLOT_CAPABILITY,
  APPOINTMENT_RECONCILE_CAPABILITY,
  APPOINTMENT_REMINDER_DUE_CAPABILITY,
  APPOINTMENT_CANCEL_CAPABILITY,
  APPOINTMENT_RESCHEDULE_CAPABILITY,
  APPOINTMENT_SESSION_EXPIRE_CAPABILITY,
  A5_TEMPLATE_OFFER_ID,
  A5_TEMPLATE_CONFIRM_ID,
  A5_TEMPLATE_REMINDER_ID,
  A5_TEMPLATE_VERSION,
  OWNER_CALL_DURATION_REQUIRED,
  OWNER_TIMEZONE_REQUIRED,
  OWNER_WORKING_HOURS_REQUIRED,
  OWNER_MIN_LEAD_TIME_REQUIRED,
  OWNER_BOOKING_HORIZON_REQUIRED,
  OWNER_BUFFER_POLICY_REQUIRED,
  OWNER_SLOT_COUNT_REQUIRED,
  OWNER_BOOKING_EXPIRY_REQUIRED,
  OWNER_REMINDER_POLICY_REQUIRED,
  OWNER_RESCHEDULE_POLICY_REQUIRED,
  OWNER_CANCELLATION_POLICY_REQUIRED,
  OWNER_NO_BOOKING_POLICY_REQUIRED,
  OWNER_CALENDAR_PROVIDER_DECISION_REQUIRED,
  APPOINTMENT_RETENTION_POLICY_REQUIRED,
  TEST_APPOINTMENT_POLICY_V1,
  isAllowedAppointmentPurpose,
  eligibilityFingerprint,
} from './a5-appointment-contracts.js';

/* DTH-A6 Document Intelligence contracts */
export {
  A6_DOCUMENT_POLICY_ID,
  A6_DOCUMENT_POLICY_VERSION,
  A6_EXTRACTOR_ID,
  A6_EXTRACTOR_VERSION,
  A6_CLASSIFIER_ID,
  A6_CLASSIFIER_VERSION,
  TEST_MAX_DOCUMENT_BYTES,
  TEST_MAX_EXTRACTED_TEXT_CHARS,
  LIVE_DOCUMENT_STORAGE_PROVIDER_CALLS,
  LIVE_OCR_PROVIDER_CALLS,
  LIVE_AI_CALLS_A6,
  DOCUMENT_INTELLIGENCE_PREPARE_CAPABILITY,
  DOCUMENT_PROCESS_CAPABILITY,
  ENERGY_TARIFF_EVALUATION_PREPARE_HANDOFF,
  DocumentSourceKind,
  DocumentStatus,
  DocumentType,
  OcrStatus,
  DocumentFactStatus,
  ConfidenceClass,
  FactConfidenceClass,
  FactValueType,
  DocumentFactCode,
  DocumentFactsReadiness,
  OWNER_DOCUMENT_STORAGE_PROVIDER_REQUIRED,
  OWNER_OCR_PROVIDER_DECISION_REQUIRED,
  OWNER_DOCUMENT_RETENTION_POLICY_REQUIRED,
  OWNER_CUSTOMER_UPLOAD_UI_DECISION_REQUIRED,
  OWNER_DOCUMENT_REQUEST_COMMUNICATION_REQUIRED,
  OWNER_MALWARE_SCANNER_PROVIDER_REQUIRED,
  DocumentKillDomain,
} from './a6-document-contracts.js';

/* DTH-A7 Energy + Tariff Domain contracts */
export {
  ENERGY_TARIFF_EVALUATION_PREPARE_CAPABILITY,
  OFFER_PREPARE_HANDOFF,
  A7_CALCULATION_POLICY_ID,
  A7_CALCULATION_POLICY_VERSION,
  A7_RANKING_POLICY_ID,
  A7_RANKING_POLICY_VERSION,
  A7_EXTRACTOR_ID,
  A7_EXTRACTOR_VERSION,
  A7_ELIGIBILITY_POLICY_ID,
  A7_ELIGIBILITY_POLICY_VERSION,
  MICRO_EUR_SCALE,
  LIVE_TARIFF_PROVIDER_CALLS,
  LIVE_SUPPLIER_API_CALLS,
  LIVE_AI_CALLS_A7,
  TariffStatus,
  EnergyType,
  CustomerSegment,
  PriceBasis,
  ComponentType,
  ComponentFrequency,
  ComponentAppliesTo,
  EligibilityStatus,
  EvaluationReadiness,
  EvaluationStatus,
  EligibilityReasonCode,
  EligibilityRuleType,
  TariffSourceKind,
  ProfileReadiness,
  BaselineSource,
  OWNER_LIVE_TARIFF_SOURCE_REQUIRED,
  OWNER_TARIFF_RANKING_POLICY_REQUIRED,
  OWNER_ENERGY_BUSINESS_RULE_REQUIRED,
  OWNER_VAT_TAX_POLICY_REQUIRED,
  OWNER_TARIFF_IMPORT_PROVIDER_REQUIRED,
  OWNER_COMMISSION_DATA_POLICY_REQUIRED,
  TariffKillDomain,
} from './a7-tariff-contracts.js';
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
