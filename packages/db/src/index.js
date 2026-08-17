/** @deintarifheld/db — draft metadata + P3-F5 local outbox claim adapter */
export const DTH_PACKAGE_SKELETON = Object.freeze({
  name: '@deintarifheld/db',
  tranche: 'P3-F5',
  skeletonOnly: true,
  draftMigrationsOnly: true,
  migrationApplicationAuthorized: false,
});

export {
  P3_F2A_DRAFT_ROOT,
  P3_F2A_DRAFT_FILES,
  P3_F2A_FIRST_SLICE_TABLES,
  P3_F2A_SOFT_DELETE_TABLES,
  P3_F2A_FORBIDDEN_TABLE_SUBSTRINGS,
  P3_F2A_PROTECTED_SPINE_TABLES,
  P3_F2A_CLAIMS,
} from './draft-catalog.js';

export {
  createLocalOutboxPool,
  claimOneSyntheticNoop,
  markOutboxProcessed,
  markOutboxFailed,
} from './outbox-claim.js';

/* DTH-A1 durable workflow / control storage */
export { assertWorkflowSchemaCompatible } from './workflow/schema-gate.js';
export {
  readControlVersion,
  setGlobalKill,
  setDomainKill,
  pauseWorkflowControl,
  resumeWorkflowControl,
  activateTakeover,
  readFreshControlSnapshot,
  evaluatePreEffectControl,
  withControlTx,
} from './workflow/control.js';
export {
  startWorkflowIdempotent,
  enqueueLeadAcceptedWorkflowStart,
  createFollowOnJob,
  completeWorkflowIfTerminal,
  markWorkflowBlocked,
} from './workflow/instances.js';
export {
  reclaimExpiredLeases,
  claimDueJobs,
  markJobRunning,
  renewLease,
} from './workflow/claim.js';
export {
  computeBackoffMs,
  completeJobSuccess,
  scheduleRetryOrDeadLetter,
  failPermanent,
  cancelJob,
  reprocessDeadLetter,
  blockJobForControl,
} from './workflow/transitions.js';
export { getWorkflowRuntimeStats } from './workflow/stats.js';
export {
  ingestSyntheticOutboxEvent,
  A1_SYNTHETIC_OUTBOX_EVENT,
} from './workflow/outbox-ingest.js';

/* DTH-A2 Lead → Case handoff */
export { acceptBusinessLeadAtomic } from './a2/atomic-intake.js';
export {
  claimOneSourceEvent,
  markSourceEventProcessed,
  markSourceEventFailed,
  markSourceEventPermanentFailed,
} from './a2/source-outbox.js';
export {
  loadLeadProjection,
  findCaseBySourceLead,
  createCaseFromLead,
  findWorkflowForLead,
  findInitialQualificationJob,
  isHandoffComplete,
  reconcileLeadToCaseHandoff,
  processOneBusinessLeadHandoff,
  detectHandoffOrphans,
} from './a2/handoff.js';

/* DTH-A3 B2B qualification */
export { evaluateQualification, applyQualificationObservation, getCurrentQualification, getOpenMissingRequirements, getQualificationRevision, isQualificationRevisionCurrent } from './a3/evaluate.js';
export { normalizeLeadFields, parseConsumptionKwh, normalizeEnergyType, normalizeStandorte } from './a3/normalize.js';
export { B2B_QUALIFICATION_POLICY_V1, evaluateCallReadiness, computeInputFingerprint } from './a3/policy.js';

/* DTH-A4 Communication Engine */
export {
  createMockEmailProvider,
  createResendEmailProvider,
  resetProviderTestStore,
  setProviderTestMode,
  getProviderLiveCallCount,
  seedReceivedEmail,
  hashEmail,
  redactEmail,
} from './a4/provider.js';
export { renderMissingInfoMessage } from './a4/template.js';
export { interpretMissingInfoReply, interpretMissingInfoReplyAi } from './a4/interpret.js';
export {
  prepareMissingInfoCommunication,
  executeCommunicationSend,
  executeFollowupDue,
  acceptInboundWebhook,
  processInboundEvent,
  applyProviderDeliveryEvent,
  cancelFollowupsForConversation,
  cancelStaleOutboundIntents,
} from './a4/communicate.js';

/* DTH-A5 Calendar + Appointment */
export {
  createTestCalendarProvider,
  resetCalendarProviderTestStore,
  setCalendarProviderTestMode,
  getCalendarLiveCallCount,
  seedBusyPeriod,
  seedProviderEvent,
} from './a5/provider.js';
export { generateCandidateSlots } from './a5/slots.js';
export { zonedLocalToUtc, zonedParts, formatInTimeZone, getTimeZoneOffsetMs } from './a5/timezone.js';
export { renderAppointmentMessage } from './a5/templates.js';
export {
  prepareAppointmentOffer,
  getBookingSessionByToken,
  listSessionSlots,
  getPublicBookingView,
  submitSlotSelection,
  executeBookSelectedSlot,
  reconcileAppointment,
  executeAppointmentReminder,
  cancelAppointment,
  rescheduleAppointment,
  expireBookingSession,
  a6HandoffFromAppointment,
} from './a5/booking.js';
