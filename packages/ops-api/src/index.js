/** @deintarifheld/ops-api — AuthN + P3-F6 kill-switch foundation (no prod wiring) */
export { DTH_PACKAGE_SKELETON } from './skeleton.js';
export {
  SYNTHETIC_OWNER_PERSON_ID,
  authenticateLocalOwner,
  authenticateSharedSecretAsOwner,
} from './auth/local-owner-auth.js';
export {
  requirePersonCcSession,
  attemptSharedSecretCcSession,
  attemptServiceCcSession,
  attemptBreakGlassCcSession,
} from './auth/cc-session-gate.js';
export { createInMemoryKillStore } from './kill/memory-store.js';
export { createInMemoryKillAuditLog } from './kill/audit-log.js';
export { createKillSwitchService } from './kill/service.js';
