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

/* DTH-A6 Document Intelligence */
export {
  createLocalTestDocumentStorage,
  resetLocalTestDocumentStorage,
  getDocumentStorageLiveCallCount,
} from './a6/storage.js';
export {
  detectPdfMagic,
  sanitizeFilename,
  assertNoPathTraversal,
  validateDocumentBytes,
} from './a6/validate.js';
export { extractTextFromPdfBytes } from './a6/pdf-text.js';
export { classifyDocumentText } from './a6/classify.js';
export { parseDocumentConsumptionKwh } from './a6/numbers.js';
export { extractFactsFromText } from './a6/extract-facts.js';
export {
  createDocumentMalwareScanner,
  resetDocumentMalwareScanner,
  setDocumentMalwareScannerMode,
} from './a6/malware.js';
export {
  buildMinimalPdf,
  buildEmptyTextPdf,
  buildElectricityInvoicePdf,
  buildGasInvoicePdf,
  buildMultiLocationPdf,
  buildPromptInjectionPdf,
  buildVagueTermPdf,
} from './a6/fixtures.js';
export {
  ingestTestDocument,
  acceptA4AttachmentHandoff,
  prepareDocumentIntelligence,
  processDocument,
  reprocessDocument,
  detectFactConflicts,
  getCaseEnergyEvidence,
} from './a6/process.js';
export { parseExactGermanDate } from './a6/numbers.js';
export { extractEnergyFactsFromText } from './a6/extract-facts.js';
export { createTestMalwareScanner, setMalwareScannerTestMode } from './a6/malware.js';

/* DTH-A7 Energy + Tariff Domain */
export { toMicroEur, fromMicroEurDisplay, mulConsumptionRate, annualizeFixed, roundFinal } from './a7/money.js';
export { TariffCalculationPolicyV1, TariffRankingPolicyV1, rankEligibleResults } from './a7/policy.js';
export { buildSyntheticCatalogueDefinitions, SYNTHETIC_SUPPLIERS } from './a7/fixtures.js';
export {
  importSyntheticCatalogue,
  getActiveCatalogueSnapshot,
  loadSnapshotTariffs,
  clearTariffCatalogue,
} from './a7/catalogue.js';
export { buildEnergyProfile, getCurrentEnergyProfile } from './a7/profile.js';
export { evaluateTariffEligibility } from './a7/eligibility.js';
export { calculateTariffCost } from './a7/pricing.js';
export { compareToBaseline } from './a7/compare.js';
export { prepareTariffEvaluation, runTariffEvaluation } from './a7/evaluate.js';
export { getCurrentTariffEvaluation, isTariffEvaluationCurrent } from './a7/handoff.js';

/* DTH-A8 Offer Engine */
export { OfferPolicyV1, mergeOfferPolicy, tryMergeOfferPolicy } from './a8/policy.js';
export { formatMicroEurDe, formatMicroEurDePlain, escapeHtml, priceBasisLabelDe } from './a8/format.js';
export {
  prepareOffer,
  getCurrentOffer,
  mintOfferToken,
  hashOfferToken,
  offerControlGate,
  hasTakeover,
  resolveOfferContact,
  buildCommercialSnapshot,
  hashCanonical,
} from './a8/prepare.js';
export { recordSyntheticOfferApproval } from './a8/approval.js';
export { renderOfferText, renderOfferHtml, buildPublicOfferViewModel } from './a8/render.js';
export {
  deliverOffer,
  expireOffer,
  cancelOfferFollowups,
  reconcileOfferDelivery,
  loadOfferRevision,
  loadOfferOptions,
  assertOfferIntentSendable,
} from './a8/deliver.js';
export { getPublicOfferView, acceptOffer, rejectOffer, attemptMarkCustomerLive } from './a8/customer.js';
export { executeOfferFollowup } from './a8/followup.js';
export { createSwitchPreparation, ackSwitchPreparation } from './a8/a9.js';

/* DTH-A9 Switching Workflow */
export { SwitchingPolicyV1, mergeSwitchingPolicy } from './a9/policy.js';
export {
  createTestSwitchProvider,
  resetSwitchProviderTestStore,
  setSwitchProviderTestMode,
  getSwitchProviderLiveCallCount,
  getSwitchProviderSubmitCount,
} from './a9/provider.js';
export { buildSwitchPayload, hashSwitchPayload, validateSwitchPayload } from './a9/payload.js';
export { wipeOfferAndSwitchingDomain } from './a9/wipe.js';
export {
  prepareSwitch,
  evaluateSwitchReadiness,
  loadAcceptedOfferAuthority,
  recordSwitchFact,
  getSwitchCase,
  getCurrentSwitchAttempt,
  listSwitchFacts,
  switchControlGate,
} from './a9/prepare.js';
export { submitSwitchAttempt, recordSyntheticSwitchApproval } from './a9/submit.js';
export {
  reconcileSwitchAttempt,
  applyProviderEvent,
  createLifecycleHandoff,
  ackCustomerLifecyclePrepare,
} from './a9/reconcile.js';
export { requestSwitchMissingInfo, requestSwitchConfirmation } from './a9/communicate-switch.js';

/* DTH-A10 Customer Lifecycle + Renewal */
export { ContractDatePolicyV1, addCalendarMonths, addCalendarDays, parseIsoDate, daysInMonth, todayIso } from './a10/dates.js';
export { TestLifecyclePolicyV1, mergeLifecyclePolicy } from './a10/policy.js';
export {
  createTestLifecycleProvider,
  resetLifecycleProviderTestStore,
  setLifecycleProviderTestMode,
  getLifecycleProviderLiveCallCount,
} from './a10/provider.js';
export {
  prepareLifecycle,
  getLifecycle,
  getCurrentContractSnapshot,
  listA11LifecycleProjection,
  lifecycleControlGate,
  deriveContractAnchors,
} from './a10/prepare.js';
export {
  activateLifecycleDue,
  cancelLifecycle,
  endLifecycle,
  applyLifecycleProviderEvent,
} from './a10/activate.js';
export {
  openRenewalWindow,
  evaluateRenewalEvidence,
  prepareRenewalEvaluation,
  prepareRenewalOffer,
  recordRenewalCustomerDecision,
  getCurrentRenewalCycle,
} from './a10/renewal.js';

