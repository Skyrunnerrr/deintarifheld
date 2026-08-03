/** @deintarifheld/cc — AuthN + kill contracts + P3-F4 read-only local UI */
export { DTH_PACKAGE_SKELETON } from './skeleton.js';
export { CcAuthContract, acceptCcAuthSession, acceptProtectedRouteSession } from './auth/contracts.js';
export { CcKillStatusContract, createKillStatusAdapter } from './kill/contracts.js';
export { createOpsReadClient, CC_NAV_ITEMS, CcNavItem } from './ui/ops-client.js';
export {
  renderShell,
  renderInboxTable,
  renderCasesView,
  renderTasksView,
  renderStateBlock,
  countMutationControls,
} from './ui/render.js';
export { createLocalCcServer } from './ui/create-local-cc-server.js';
