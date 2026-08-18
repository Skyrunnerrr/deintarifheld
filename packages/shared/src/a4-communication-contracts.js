/**
 * DTH-A4 Communication Engine contracts.
 * Kill domain for outbound: INTERNAL_MAIL (frozen 8-domain registry; COMMUNICATION maps here).
 */
export const A4_COMMUNICATION_POLICY_ID = 'CommunicationPolicyV1';
export const A4_COMMUNICATION_POLICY_VERSION = 1;
export const A4_TEMPLATE_MISSING_INFO_ID = 'B2B_MISSING_INFO_DE_V1';
export const A4_TEMPLATE_MISSING_INFO_VERSION = 1;

/** Synthetic test follow-up delay (Owner production cadence unresolved). */
export const A4_TEST_FOLLOWUP_DELAY_MS = 50;
export const A4_DEFAULT_MAX_FOLLOWUPS = 1;
export const OWNER_FOLLOWUP_CADENCE_REQUIRED = true;

export const B2B_MISSING_INFO_COMMUNICATE_CAPABILITY = 'B2B_MISSING_INFO_COMMUNICATE';
export const B2B_COMMUNICATION_SEND_CAPABILITY = 'B2B_COMMUNICATION_SEND';
export const B2B_MISSING_INFO_FOLLOWUP_CAPABILITY = 'B2B_MISSING_INFO_FOLLOWUP_DUE';
export const B2B_INBOUND_EMAIL_PROCESS_CAPABILITY = 'B2B_INBOUND_EMAIL_PROCESS';
export const B2B_APPOINTMENT_OFFER_PREPARE_CAPABILITY = 'APPOINTMENT_OFFER_PREPARE';

export const MessagePurpose = Object.freeze({
  MISSING_INFORMATION_REQUEST: 'MISSING_INFORMATION_REQUEST',
  MISSING_INFORMATION_FOLLOWUP: 'MISSING_INFORMATION_FOLLOWUP',
  APPOINTMENT_OFFER: 'APPOINTMENT_OFFER',
  APPOINTMENT_CONFIRMATION: 'APPOINTMENT_CONFIRMATION',
  APPOINTMENT_REMINDER: 'APPOINTMENT_REMINDER',
  APPOINTMENT_RESCHEDULE_CONFIRMATION: 'APPOINTMENT_RESCHEDULE_CONFIRMATION',
  APPOINTMENT_CANCELLATION_CONFIRMATION: 'APPOINTMENT_CANCELLATION_CONFIRMATION',
  OFFER_DELIVERY: 'OFFER_DELIVERY',
  OFFER_FOLLOWUP: 'OFFER_FOLLOWUP',
  OFFER_ACCEPTANCE_CONFIRMATION: 'OFFER_ACCEPTANCE_CONFIRMATION',
  SWITCH_MISSING_INFORMATION_REQUEST: 'SWITCH_MISSING_INFORMATION_REQUEST',
  SWITCH_MISSING_INFORMATION_FOLLOWUP: 'SWITCH_MISSING_INFORMATION_FOLLOWUP',
  SWITCH_CONFIRMATION: 'SWITCH_CONFIRMATION',
  SUPPLY_START_CONFIRMATION: 'SUPPLY_START_CONFIRMATION',
  RENEWAL_UPCOMING: 'RENEWAL_UPCOMING',
  RENEWAL_EVIDENCE_REQUIRED: 'RENEWAL_EVIDENCE_REQUIRED',
});

export const APPOINTMENT_MESSAGE_PURPOSES = Object.freeze([
  MessagePurpose.APPOINTMENT_OFFER,
  MessagePurpose.APPOINTMENT_CONFIRMATION,
  MessagePurpose.APPOINTMENT_REMINDER,
  MessagePurpose.APPOINTMENT_RESCHEDULE_CONFIRMATION,
  MessagePurpose.APPOINTMENT_CANCELLATION_CONFIRMATION,
]);

export function isAppointmentMessagePurpose(purpose) {
  return APPOINTMENT_MESSAGE_PURPOSES.includes(String(purpose || ''));
}

export const OFFER_MESSAGE_PURPOSES = Object.freeze([
  MessagePurpose.OFFER_DELIVERY,
  MessagePurpose.OFFER_FOLLOWUP,
  MessagePurpose.OFFER_ACCEPTANCE_CONFIRMATION,
]);

export function isOfferMessagePurpose(purpose) {
  return OFFER_MESSAGE_PURPOSES.includes(String(purpose || ''));
}

export const SWITCH_MESSAGE_PURPOSES = Object.freeze([
  MessagePurpose.SWITCH_MISSING_INFORMATION_REQUEST,
  MessagePurpose.SWITCH_MISSING_INFORMATION_FOLLOWUP,
  MessagePurpose.SWITCH_CONFIRMATION,
]);

export function isSwitchMessagePurpose(purpose) {
  return SWITCH_MESSAGE_PURPOSES.includes(String(purpose || ''));
}

export const LIFECYCLE_MESSAGE_PURPOSES = Object.freeze([
  MessagePurpose.SUPPLY_START_CONFIRMATION,
  MessagePurpose.RENEWAL_UPCOMING,
  MessagePurpose.RENEWAL_EVIDENCE_REQUIRED,
]);

export function isLifecycleMessagePurpose(purpose) {
  return LIFECYCLE_MESSAGE_PURPOSES.includes(String(purpose || ''));
}

export const ALLOWED_MESSAGE_PURPOSES = Object.freeze(Object.values(MessagePurpose));

export const OutboundIntentState = Object.freeze({
  INTENT_CREATED: 'INTENT_CREATED',
  READY_TO_SEND: 'READY_TO_SEND',
  PROVIDER_ACCEPTED: 'PROVIDER_ACCEPTED',
  DELIVERED: 'DELIVERED',
  BOUNCED: 'BOUNCED',
  FAILED: 'FAILED',
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
  CANCELLED_STALE: 'CANCELLED_STALE',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
});

export const ConversationStatus = Object.freeze({
  OPEN: 'OPEN',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  QUALIFIED: 'QUALIFIED',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  CLOSED: 'CLOSED',
});

export const InboundEventStatus = Object.freeze({
  RECEIVED: 'RECEIVED',
  RETRIEVED: 'RETRIEVED',
  CORRELATED: 'CORRELATED',
  INTERPRETED: 'INTERPRETED',
  PROCESSED: 'PROCESSED',
  UNMATCHED: 'UNMATCHED',
  CORRELATION_REVIEW: 'CORRELATION_REVIEW',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
});

export const FollowupStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  CLAIMED: 'CLAIMED',
  SENT: 'SENT',
  CANCELLED_REPLY: 'CANCELLED_REPLY',
  CANCELLED_QUALIFIED: 'CANCELLED_QUALIFIED',
  CANCELLED_STALE: 'CANCELLED_STALE',
  CANCELLED_BOUNCE: 'CANCELLED_BOUNCE',
  CANCELLED_MAX: 'CANCELLED_MAX',
  CANCELLED_KILL: 'CANCELLED_KILL',
});

export const FIELD_LABEL_DE = Object.freeze({
  firma: 'Firmenname',
  ansprechpartner: 'Ansprechpartner',
  email: 'E-Mail-Adresse',
  telefon: 'Telefonnummer',
  plz: 'Postleitzahl',
  energieart: 'Energieart',
  verbrauchStrom: 'Jahresverbrauch Strom in kWh',
  verbrauchGas: 'Jahresverbrauch Gas in kWh',
  standorte: 'Anzahl Ihrer Standorte',
  versorger: 'Aktueller Versorger',
  vertragslaufzeit: 'Vertragslaufzeit',
});

export function isAllowedMessagePurpose(purpose) {
  return ALLOWED_MESSAGE_PURPOSES.includes(String(purpose || ''));
}

/** Provider delivery precedence (higher wins; no regression). */
export const PROVIDER_EVENT_PRECEDENCE = Object.freeze({
  sent: 10,
  delivered: 40,
  bounced: 50,
  failed: 50,
  complained: 45,
});
