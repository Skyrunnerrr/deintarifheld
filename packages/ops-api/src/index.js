/** @deintarifheld/ops-api — P3-F1 AuthN foundation (no BFF business logic) */
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
