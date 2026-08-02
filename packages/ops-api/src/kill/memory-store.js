/**
 * LOCAL_DEV_ONLY in-memory kill registry — not production persistence.
 * PERSISTENCE_ADAPTER=LOCAL_DEV_ONLY · PRODUCTION_PERSISTENCE_READY=NO
 */
import {
  KILL_DOMAINS,
  createDefaultKillRegistry,
  isKillDomain,
  isKillState,
} from '@deintarifheld/shared';

export function createInMemoryKillStore(initial = createDefaultKillRegistry()) {
  const state = { ...createDefaultKillRegistry(), ...initial };
  for (const domain of KILL_DOMAINS) {
    if (!isKillState(state[domain])) {
      throw new Error(`KILL_STATE_MALFORMED:${domain}`);
    }
  }

  return {
    persistenceAdapter: 'LOCAL_DEV_ONLY',
    productionPersistenceReady: false,
    list() {
      return KILL_DOMAINS.map((domain) => ({
        domain,
        state: state[domain],
      }));
    },
    get(domain) {
      if (!isKillDomain(domain)) {
        return { ok: false, code: 'UNKNOWN_KILL_DOMAIN' };
      }
      return { ok: true, domain, state: state[domain] };
    },
    set(domain, nextState) {
      if (!isKillDomain(domain)) {
        return { ok: false, code: 'UNKNOWN_KILL_DOMAIN' };
      }
      if (!isKillState(nextState)) {
        return { ok: false, code: 'KILL_STATE_MALFORMED_FAIL_CLOSED' };
      }
      const previous = state[domain];
      state[domain] = nextState;
      return { ok: true, domain, previousState: previous, newState: nextState };
    },
    snapshot() {
      return { ...state };
    },
  };
}
