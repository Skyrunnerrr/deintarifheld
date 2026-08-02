/**
 * P3-F6 local/dev kill defaults — configuration only; not wired to public runtime.
 *
 * INACTIVE = no kill override (existing approved surfaces remain behaviorally unchanged
 *            until/unless separately wired; F6 does not wire production)
 * ACTIVE   = kill override on (capabilities that are not yet authorized stay blocked)
 */
import { KillDomain } from './kill-domains.js';
import { KillState } from './kill-state.js';

export const LOCAL_DEV_KILL_DEFAULTS = Object.freeze({
  [KillDomain.PUBLIC_INTAKE]: KillState.INACTIVE,
  [KillDomain.API_PROCESSING]: KillState.INACTIVE,
  [KillDomain.INTERNAL_MAIL]: KillState.INACTIVE,
  [KillDomain.MARKETING_MAIL]: KillState.ACTIVE,
  [KillDomain.AUTOMATION_ENGINE]: KillState.ACTIVE,
  [KillDomain.DATA_IMPORT]: KillState.ACTIVE,
  [KillDomain.PARTNER_ACCESS]: KillState.ACTIVE,
  [KillDomain.COMMAND_CENTER_WRITE_ACTIONS]: KillState.ACTIVE,
});

export function createDefaultKillRegistry() {
  return { ...LOCAL_DEV_KILL_DEFAULTS };
}
