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
