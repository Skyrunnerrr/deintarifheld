/** @deintarifheld/ops-api — AuthN + kill-switch + P3-F3 Ops BFF + P3-F4 local HTTP read adapter */
export { DTH_PACKAGE_SKELETON } from './skeleton.js';
export {
  SYNTHETIC_OWNER_PERSON_ID,
  authenticateLocalOwner,
  authenticateSharedSecretAsOwner,
} from './auth/local-owner-auth.js';
export { authenticateTestOperator } from './auth/test-operator-auth.js';
export {
  requirePersonCcSession,
  attemptSharedSecretCcSession,
  attemptServiceCcSession,
  attemptBreakGlassCcSession,
} from './auth/cc-session-gate.js';
export { createInMemoryKillStore } from './kill/memory-store.js';
export { createInMemoryKillAuditLog } from './kill/audit-log.js';
export { createKillSwitchService } from './kill/service.js';
export { INTERNAL_BFF_PREFIX, LimitedWriteOperation } from './bff/constants.js';
export { createOpsBff } from './bff/create-ops-bff.js';
export { gateOpsRequest, gateA11Request } from './bff/auth-gate.js';
export {
  createLocalOpsHttpReadAdapter,
  encodeLocalAuthToken,
} from './bff/http-read-adapter.js';
export {
  verifyHostedSupabaseSession,
  resolveHostedOperatorFromSession,
  gateHostedA11Request,
  extractBearerAccessToken,
  sanitizeAuthLogValue,
  denyTestIdentityInHostedMode,
  assertSafeAuthRedirect,
  normalizeAssuranceLevel,
  HostedAuthErrorCode,
  OperatorAuthMode,
  OPERATOR_SESSION_POLICY_V1,
} from './auth/hosted-session.js';
