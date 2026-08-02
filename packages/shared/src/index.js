/** @deintarifheld/shared — P3-F0 skeleton + P3-F1 authn foundation exports */
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
