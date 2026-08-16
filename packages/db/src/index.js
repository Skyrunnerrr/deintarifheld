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
