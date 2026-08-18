/**
 * Deterministic test lifecycle provider. No network.
 */
const store = { mode: 'ACTIVE', liveCalls: 0, byLifecycle: new Map() };

export function resetLifecycleProviderTestStore() {
  store.mode = 'ACTIVE';
  store.liveCalls = 0;
  store.byLifecycle.clear();
}

export function setLifecycleProviderTestMode(mode) {
  store.mode = mode;
}

export function getLifecycleProviderLiveCallCount() {
  return store.liveCalls;
}

export function createTestLifecycleProvider() {
  return {
    async getContractStatus({ lifecycleId }) {
      if (store.mode === 'FORCE_LIVE') {
        store.liveCalls += 1;
        throw new Error('LIVE_LIFECYCLE_PROVIDER_FORBIDDEN_IN_E2');
      }
      if (store.mode === 'CANCELLED') return { ok: true, status: 'CANCELLED' };
      if (store.mode === 'ENDED') return { ok: true, status: 'ENDED' };
      if (store.mode === 'PRODUCT_MISMATCH') return { ok: true, status: 'PRODUCT_MISMATCH', productRef: 'OTHER' };
      if (store.mode === 'PRE_ACTIVE') return { ok: true, status: 'PRE_ACTIVE' };
      if (store.mode === 'STATUS_UNKNOWN') return { ok: true, status: 'STATUS_UNKNOWN' };
      void lifecycleId;
      return { ok: true, status: store.mode || 'ACTIVE' };
    },
  };
}
