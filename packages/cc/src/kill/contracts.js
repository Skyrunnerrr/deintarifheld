/**
 * P3-F6 CC kill-status contracts — non-UI only.
 * No dashboard, navigation, buttons, or write UI.
 * STRONG_AUTHZ_COMPLETE=NO
 */
import { KILL_DOMAINS, KILL_DOMAIN_COUNT } from '@deintarifheld/shared';

export const CcKillStatusContract = Object.freeze({
  uiImplemented: false,
  writeActionsViaUi: false,
  strongAuthzComplete: false,
  productionAuthzReady: false,
  domainCount: KILL_DOMAIN_COUNT,
  domains: KILL_DOMAINS,
  persistenceAdapter: 'LOCAL_DEV_ONLY',
  note: 'Readable kill status only; mutations via ops-api Owner service',
});

/**
 * Typed adapter interface for later CC consumption of readable kill status.
 * Implementations must not live in UI layers in P3-F6.
 */
export function createKillStatusAdapter(reader) {
  if (!reader || typeof reader.readAll !== 'function' || typeof reader.readOne !== 'function') {
    throw new Error('KILL_STATUS_READER_REQUIRED');
  }
  return Object.freeze({
    kind: 'KillStatusAdapter',
    uiImplemented: false,
    async listStatuses() {
      return reader.readAll();
    },
    async getStatus(domain) {
      return reader.readOne(domain);
    },
  });
}
