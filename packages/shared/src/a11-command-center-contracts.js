/**
 * DTH-A11 Production Command Center — contracts only.
 * UI is not authority. Client role is not authority. E2 test identity unless a
 * real operator auth provider already exists (it does not).
 */

export const A11_COMMAND_CENTER_POLICY_ID = 'A11_OPERATOR_CONTROL_POLICY_V1';
export const A11_COMMAND_CENTER_POLICY_VERSION = 1;
export const A11_STAGE_POLICY_ID = 'A11_STAGE_PROJECTION_POLICY_V1';
export const A11_STAGE_POLICY_VERSION = 1;
export const A11_INBOX_POLICY_ID = 'A11_INBOX_SEVERITY_POLICY_V1';
export const A11_INBOX_POLICY_VERSION = 1;

export const OWNER_COMMAND_CENTER_AUTH_PROVIDER_REQUIRED = true;
export const OWNER_OPERATOR_SESSION_POLICY_REQUIRED = true;
export const OWNER_COMMAND_CENTER_DEPLOYMENT_DECISION_REQUIRED = true;
export const OWNER_COMMAND_CENTER_ROLE_POLICY_REQUIRED = true;
export const OWNER_AUDIT_RETENTION_POLICY_REQUIRED = true;
export const STRONG_AUTHZ_COMPLETE = false;
export const STAGING_COMMAND_CENTER_READY = false;
export const PRODUCTION_COMMAND_CENTER_READY = false;
export const STAGING_AUTONOMY_READY = false;
export const PRODUCTION_AUTONOMY_READY = false;
export const A11_LIVE_AI_CALLS = 0;

export const OperatorRole = Object.freeze({
  VIEWER: 'VIEWER',
  OPERATOR: 'OPERATOR',
  APPROVER: 'APPROVER',
  OWNER: 'OWNER',
});

export const OperatorCapability = Object.freeze({
  CASE_VIEW: 'CASE_VIEW',
  TASK_WRITE: 'TASK_WRITE',
  NOTE_WRITE: 'NOTE_WRITE',
  APPROVAL_DECIDE: 'APPROVAL_DECIDE',
  TAKEOVER_MANAGE: 'TAKEOVER_MANAGE',
  WORKFLOW_REPROCESS: 'WORKFLOW_REPROCESS',
  PROVIDER_RECONCILE: 'PROVIDER_RECONCILE',
  GLOBAL_KILL_MANAGE: 'GLOBAL_KILL_MANAGE',
  DOMAIN_KILL_MANAGE: 'DOMAIN_KILL_MANAGE',
  AUDIT_VIEW: 'AUDIT_VIEW',
  CONTENT_VIEW: 'CONTENT_VIEW',
  CONTENT_APPROVE: 'CONTENT_APPROVE',
  CONTENT_CANCEL: 'CONTENT_CANCEL',
  CONTENT_RECONCILE: 'CONTENT_RECONCILE',
});

const ALL_CAPS = Object.freeze(Object.values(OperatorCapability));

export const ROLE_CAPABILITIES = Object.freeze({
  [OperatorRole.VIEWER]: Object.freeze([
    OperatorCapability.CASE_VIEW,
    OperatorCapability.AUDIT_VIEW,
    OperatorCapability.CONTENT_VIEW,
  ]),
  [OperatorRole.OPERATOR]: Object.freeze([
    OperatorCapability.CASE_VIEW,
    OperatorCapability.AUDIT_VIEW,
    OperatorCapability.TASK_WRITE,
    OperatorCapability.NOTE_WRITE,
    OperatorCapability.TAKEOVER_MANAGE,
    OperatorCapability.WORKFLOW_REPROCESS,
    OperatorCapability.PROVIDER_RECONCILE,
    OperatorCapability.CONTENT_VIEW,
    OperatorCapability.CONTENT_CANCEL,
    OperatorCapability.CONTENT_RECONCILE,
  ]),
  [OperatorRole.APPROVER]: Object.freeze([
    OperatorCapability.CASE_VIEW,
    OperatorCapability.AUDIT_VIEW,
    OperatorCapability.APPROVAL_DECIDE,
    OperatorCapability.NOTE_WRITE,
    OperatorCapability.CONTENT_VIEW,
    OperatorCapability.CONTENT_APPROVE,
  ]),
  [OperatorRole.OWNER]: ALL_CAPS,
});

export const TEST_OPERATOR_IDENTITIES = Object.freeze({
  TEST_OWNER: Object.freeze({
    personId: 'person_synth_owner_dth_local_001',
    role: OperatorRole.OWNER,
    label: 'TEST_OWNER',
    productionIdentity: false,
  }),
  TEST_OPERATOR: Object.freeze({
    personId: 'person_synth_operator_dth_local_001',
    role: OperatorRole.OPERATOR,
    label: 'TEST_OPERATOR',
    productionIdentity: false,
  }),
  TEST_APPROVER: Object.freeze({
    personId: 'person_synth_approver_dth_local_001',
    role: OperatorRole.APPROVER,
    label: 'TEST_APPROVER',
    productionIdentity: false,
  }),
  TEST_VIEWER: Object.freeze({
    personId: 'person_synth_viewer_dth_local_001',
    role: OperatorRole.VIEWER,
    label: 'TEST_VIEWER',
    productionIdentity: false,
  }),
});

export const TEST_OPERATOR_BY_PERSON_ID = Object.freeze(
  Object.fromEntries(
    Object.values(TEST_OPERATOR_IDENTITIES).map((row) => [row.personId, row]),
  ),
);

export const OperatorCommandType = Object.freeze({
  TAKEOVER_CASE: 'TAKEOVER_CASE',
  RESUME_CASE: 'RESUME_CASE',
  APPROVE_OFFER: 'APPROVE_OFFER',
  REJECT_OFFER_APPROVAL: 'REJECT_OFFER_APPROVAL',
  APPROVE_SWITCH_SUBMISSION: 'APPROVE_SWITCH_SUBMISSION',
  REJECT_SWITCH_SUBMISSION: 'REJECT_SWITCH_SUBMISSION',
  REPROCESS_JOB: 'REPROCESS_JOB',
  RECONCILE_COMMUNICATION: 'RECONCILE_COMMUNICATION',
  RECONCILE_APPOINTMENT: 'RECONCILE_APPOINTMENT',
  RECONCILE_OFFER_DELIVERY: 'RECONCILE_OFFER_DELIVERY',
  RECONCILE_SWITCH: 'RECONCILE_SWITCH',
  RECONCILE_LIFECYCLE: 'RECONCILE_LIFECYCLE',
  APPROVE_CONTENT: 'APPROVE_CONTENT',
  REJECT_CONTENT: 'REJECT_CONTENT',
  CANCEL_CONTENT_PUBLICATION: 'CANCEL_CONTENT_PUBLICATION',
  RECONCILE_CONTENT_PUBLICATION: 'RECONCILE_CONTENT_PUBLICATION',
  SET_GLOBAL_KILL: 'SET_GLOBAL_KILL',
  SET_DOMAIN_KILL: 'SET_DOMAIN_KILL',
  CREATE_TASK: 'CREATE_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  ADD_NOTE: 'ADD_NOTE',
});

export const COMMAND_REQUIRED_CAPABILITY = Object.freeze({
  [OperatorCommandType.TAKEOVER_CASE]: OperatorCapability.TAKEOVER_MANAGE,
  [OperatorCommandType.RESUME_CASE]: OperatorCapability.TAKEOVER_MANAGE,
  [OperatorCommandType.APPROVE_OFFER]: OperatorCapability.APPROVAL_DECIDE,
  [OperatorCommandType.REJECT_OFFER_APPROVAL]: OperatorCapability.APPROVAL_DECIDE,
  [OperatorCommandType.APPROVE_SWITCH_SUBMISSION]: OperatorCapability.APPROVAL_DECIDE,
  [OperatorCommandType.REJECT_SWITCH_SUBMISSION]: OperatorCapability.APPROVAL_DECIDE,
  [OperatorCommandType.REPROCESS_JOB]: OperatorCapability.WORKFLOW_REPROCESS,
  [OperatorCommandType.RECONCILE_COMMUNICATION]: OperatorCapability.PROVIDER_RECONCILE,
  [OperatorCommandType.RECONCILE_APPOINTMENT]: OperatorCapability.PROVIDER_RECONCILE,
  [OperatorCommandType.RECONCILE_OFFER_DELIVERY]: OperatorCapability.PROVIDER_RECONCILE,
  [OperatorCommandType.RECONCILE_SWITCH]: OperatorCapability.PROVIDER_RECONCILE,
  [OperatorCommandType.RECONCILE_LIFECYCLE]: OperatorCapability.PROVIDER_RECONCILE,
  [OperatorCommandType.APPROVE_CONTENT]: OperatorCapability.CONTENT_APPROVE,
  [OperatorCommandType.REJECT_CONTENT]: OperatorCapability.CONTENT_APPROVE,
  [OperatorCommandType.CANCEL_CONTENT_PUBLICATION]: OperatorCapability.CONTENT_CANCEL,
  [OperatorCommandType.RECONCILE_CONTENT_PUBLICATION]: OperatorCapability.CONTENT_RECONCILE,
  [OperatorCommandType.SET_GLOBAL_KILL]: OperatorCapability.GLOBAL_KILL_MANAGE,
  [OperatorCommandType.SET_DOMAIN_KILL]: OperatorCapability.DOMAIN_KILL_MANAGE,
  [OperatorCommandType.CREATE_TASK]: OperatorCapability.TASK_WRITE,
  [OperatorCommandType.UPDATE_TASK]: OperatorCapability.TASK_WRITE,
  [OperatorCommandType.ADD_NOTE]: OperatorCapability.NOTE_WRITE,
});

export const HIGH_RISK_COMMANDS = Object.freeze([
  OperatorCommandType.SET_GLOBAL_KILL,
  OperatorCommandType.SET_DOMAIN_KILL,
  OperatorCommandType.APPROVE_SWITCH_SUBMISSION,
  OperatorCommandType.APPROVE_CONTENT,
  OperatorCommandType.CANCEL_CONTENT_PUBLICATION,
  OperatorCommandType.RECONCILE_CONTENT_PUBLICATION,
  OperatorCommandType.REPROCESS_JOB,
  OperatorCommandType.RECONCILE_SWITCH,
  OperatorCommandType.TAKEOVER_CASE,
]);

export const COMMANDS_REQUIRING_REASON = Object.freeze([
  OperatorCommandType.SET_GLOBAL_KILL,
  OperatorCommandType.SET_DOMAIN_KILL,
  OperatorCommandType.TAKEOVER_CASE,
  OperatorCommandType.RESUME_CASE,
  OperatorCommandType.REPROCESS_JOB,
  OperatorCommandType.REJECT_OFFER_APPROVAL,
  OperatorCommandType.REJECT_SWITCH_SUBMISSION,
  OperatorCommandType.REJECT_CONTENT,
  OperatorCommandType.CANCEL_CONTENT_PUBLICATION,
]);

export const ReconcileDomain = Object.freeze({
  COMMUNICATION: 'COMMUNICATION',
  APPOINTMENT: 'APPOINTMENT',
  OFFER_DELIVERY: 'OFFER_DELIVERY',
  SWITCH: 'SWITCH',
  LIFECYCLE: 'LIFECYCLE',
  CONTENT: 'CONTENT',
});

export const ExceptionSeverity = Object.freeze({
  INFO: 'INFO',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const WaitingOn = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  PROVIDER: 'PROVIDER',
  HUMAN_APPROVAL: 'HUMAN_APPROVAL',
  AUTOMATION: 'AUTOMATION',
  SCHEDULED_TIME: 'SCHEDULED_TIME',
  NONE: 'NONE',
});

export const CaseStage = Object.freeze({
  EXCEPTION: 'EXCEPTION',
  QUALIFYING: 'QUALIFYING',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  APPOINTMENT: 'APPOINTMENT',
  DOCUMENT_REVIEW: 'DOCUMENT_REVIEW',
  TARIFF_EVALUATION: 'TARIFF_EVALUATION',
  OFFER_PENDING: 'OFFER_PENDING',
  SWITCH_PENDING: 'SWITCH_PENDING',
  ACTIVE: 'ACTIVE',
  RENEWAL_DUE: 'RENEWAL_DUE',
  OPEN: 'OPEN',
});

export const A11ErrorCode = Object.freeze({
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  SESSION_MISSING: 'SESSION_MISSING',
  FORGED_ROLE_IGNORED: 'FORGED_ROLE_IGNORED',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  STALE_OPERATOR_VIEW: 'STALE_OPERATOR_VIEW',
  STALE_APPROVAL: 'STALE_APPROVAL',
  CONTROL_UNAVAILABLE: 'CONTROL_UNAVAILABLE',
  TAKEOVER_ACTIVE: 'TAKEOVER_ACTIVE',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  NOT_REPROCESSABLE: 'NOT_REPROCESSABLE',
  APPROVAL_ALREADY_DECIDED: 'APPROVAL_ALREADY_DECIDED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  REASON_REQUIRED: 'REASON_REQUIRED',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BODY_TOO_LARGE: 'BODY_TOO_LARGE',
});

export const A11ReadLimit = Object.freeze({
  DEFAULT: 50,
  MAX: 100,
});

export const OPERATOR_COMMAND_MAX_BYTES = 32 * 1024;

export function capabilitiesForRole(role) {
  return ROLE_CAPABILITIES[role] || [];
}

export function roleHasCapability(role, capability) {
  return capabilitiesForRole(role).includes(capability);
}

export function isOperatorCommandType(value) {
  return Object.prototype.hasOwnProperty.call(OperatorCommandType, value);
}

export function isHighRiskCommand(type) {
  return HIGH_RISK_COMMANDS.includes(type);
}
