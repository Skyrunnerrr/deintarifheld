/**
 * DTH-A5 Calendar + Appointment Agent contracts.
 * Calendar provider writes map to KillDomain.AUTOMATION_ENGINE (frozen 8-domain registry).
 * Appointment customer mail maps to INTERNAL_MAIL via A4.
 * LIVE_CALENDAR_PROVIDER_CALLS=0 for E2.
 */
export const A5_APPOINTMENT_POLICY_ID = 'AppointmentPolicyV1';
export const A5_APPOINTMENT_POLICY_VERSION = 1;
export const A5_CALENDAR_RESOURCE_DEFAULT = 'dth_default_resource';
export const A5_PROVIDER_TEST = 'test_calendar';

export const AppointmentPurpose = Object.freeze({
  INITIAL_B2B_CONSULTATION: 'INITIAL_B2B_CONSULTATION',
});

export const ALLOWED_APPOINTMENT_PURPOSES = Object.freeze(Object.values(AppointmentPurpose));

export const BookingSessionStatus = Object.freeze({
  PREPARING: 'PREPARING',
  OPEN: 'OPEN',
  BOOKING_IN_PROGRESS: 'BOOKING_IN_PROGRESS',
  BOOKED: 'BOOKED',
  EXPIRED: 'EXPIRED',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
  EXCEPTION: 'EXCEPTION',
});

export const AppointmentStatus = Object.freeze({
  PENDING_PROVIDER: 'PENDING_PROVIDER',
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
  CONFIRMED: 'CONFIRMED',
  CONFIRMED_MEETING_LINK_PENDING: 'CONFIRMED_MEETING_LINK_PENDING',
  CANCEL_PENDING: 'CANCEL_PENDING',
  CANCELLED: 'CANCELLED',
  RESCHEDULE_PENDING: 'RESCHEDULE_PENDING',
  SUPERSEDED: 'SUPERSEDED',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  FAILED: 'FAILED',
});

export const ConferenceStatus = Object.freeze({
  PENDING: 'PENDING',
  READY: 'READY',
  UNSUPPORTED: 'UNSUPPORTED',
  DELAYED: 'DELAYED',
});

export const ReminderStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  CANCELLED_APPOINTMENT: 'CANCELLED_APPOINTMENT',
  CANCELLED_RESCHEDULE: 'CANCELLED_RESCHEDULE',
  CANCELLED_STALE: 'CANCELLED_STALE',
  CANCELLED_SUPPRESSED: 'CANCELLED_SUPPRESSED',
  CANCELLED_KILL: 'CANCELLED_KILL',
});

/** A1 capabilities */
export const APPOINTMENT_OFFER_PREPARE_CAPABILITY = 'APPOINTMENT_OFFER_PREPARE';
export const APPOINTMENT_BOOK_SELECTED_SLOT_CAPABILITY = 'APPOINTMENT_BOOK_SELECTED_SLOT';
export const APPOINTMENT_RECONCILE_CAPABILITY = 'APPOINTMENT_RECONCILE';
export const APPOINTMENT_REMINDER_DUE_CAPABILITY = 'APPOINTMENT_REMINDER_DUE';
export const APPOINTMENT_CANCEL_CAPABILITY = 'APPOINTMENT_CANCEL';
export const APPOINTMENT_RESCHEDULE_CAPABILITY = 'APPOINTMENT_RESCHEDULE';
export const APPOINTMENT_SESSION_EXPIRE_CAPABILITY = 'APPOINTMENT_SESSION_EXPIRE';

export const A5_TEMPLATE_OFFER_ID = 'B2B_APPOINTMENT_OFFER_DE_V1';
export const A5_TEMPLATE_CONFIRM_ID = 'B2B_APPOINTMENT_CONFIRM_DE_V1';
export const A5_TEMPLATE_REMINDER_ID = 'B2B_APPOINTMENT_REMINDER_DE_V1';
export const A5_TEMPLATE_VERSION = 1;

/** Owner decisions unresolved for production — E2 uses TEST policy only. */
export const OWNER_CALL_DURATION_REQUIRED = true;
export const OWNER_TIMEZONE_REQUIRED = true;
export const OWNER_WORKING_HOURS_REQUIRED = true;
export const OWNER_MIN_LEAD_TIME_REQUIRED = true;
export const OWNER_BOOKING_HORIZON_REQUIRED = true;
export const OWNER_BUFFER_POLICY_REQUIRED = true;
export const OWNER_SLOT_COUNT_REQUIRED = true;
export const OWNER_BOOKING_EXPIRY_REQUIRED = true;
export const OWNER_REMINDER_POLICY_REQUIRED = true;
export const OWNER_RESCHEDULE_POLICY_REQUIRED = true;
export const OWNER_CANCELLATION_POLICY_REQUIRED = true;
export const OWNER_NO_BOOKING_POLICY_REQUIRED = true;
export const OWNER_CALENDAR_PROVIDER_DECISION_REQUIRED = true;
export const APPOINTMENT_RETENTION_POLICY_REQUIRED = true;

/**
 * Synthetic TEST-ONLY policy. Must never be copied into production defaults.
 * Durations intentionally short for local E2.
 */
export const TEST_APPOINTMENT_POLICY_V1 = Object.freeze({
  policyId: A5_APPOINTMENT_POLICY_ID,
  version: A5_APPOINTMENT_POLICY_VERSION,
  purpose: AppointmentPurpose.INITIAL_B2B_CONSULTATION,
  durationMinutes: 30,
  timezone: 'Europe/Berlin',
  workingDays: Object.freeze([1, 2, 3, 4, 5]), // Mon–Fri
  workingWindows: Object.freeze([{ start: '09:00', end: '17:00' }]),
  minLeadTimeMs: 0,
  bookingHorizonMs: 7 * 24 * 60 * 60 * 1000,
  bufferBeforeMs: 0,
  bufferAfterMs: 0,
  slotIntervalMinutes: 30,
  maxSlotsOffered: 5,
  bookingLinkExpiryMs: 60 * 60 * 1000,
  reminderOffsetsMs: Object.freeze([50]), // synthetic near-term
  maxReminders: 1,
  calendarResourceId: A5_CALENDAR_RESOURCE_DEFAULT,
  meetingTitle: 'DeinTarifheld Beratung',
  testOnly: true,
});

export function isAllowedAppointmentPurpose(purpose) {
  return ALLOWED_APPOINTMENT_PURPOSES.includes(String(purpose || ''));
}

export function eligibilityFingerprint({ outcome, purpose, policyVersion, resourceId }) {
  return [
    String(outcome || ''),
    String(purpose || ''),
    String(policyVersion || ''),
    String(resourceId || ''),
  ].join('|');
}
