/**
 * Deterministic in-memory test switch provider. No network.
 */
import { randomUUID } from 'node:crypto';
import { A9_TEST_PROVIDER_CODE } from '@deintarifheld/shared';

const store = {
  mode: 'ACCEPT',
  liveCalls: 0,
  orders: new Map(),
  submitCountByKey: new Map(),
};

export function resetSwitchProviderTestStore() {
  store.mode = 'ACCEPT';
  store.liveCalls = 0;
  store.orders.clear();
  store.submitCountByKey.clear();
}

export function setSwitchProviderTestMode(mode) {
  store.mode = mode;
}

export function getSwitchProviderLiveCallCount() {
  return store.liveCalls;
}

export function getSwitchProviderSubmitCount(key) {
  return store.submitCountByKey.get(key) || 0;
}

function requireNoLive() {
  if (store.mode === 'FORCE_LIVE') {
    store.liveCalls += 1;
    throw new Error('LIVE_SWITCH_PROVIDER_FORBIDDEN_IN_E2');
  }
}

export function createTestSwitchProvider(overrides = {}) {
  return {
    code: A9_TEST_PROVIDER_CODE,
    async validateSubmission(payload) {
      requireNoLive();
      if (overrides.validate) return overrides.validate(payload);
      if (store.mode === 'VALIDATION_REJECT') {
        return { ok: false, class: 'VALIDATION_REJECT', reasonCode: 'INVALID_CUSTOMER_DATA' };
      }
      if (store.mode === 'TARIFF_UNAVAILABLE') {
        return { ok: false, class: 'VALIDATION_REJECT', reasonCode: 'TARIFF_UNAVAILABLE' };
      }
      if (!payload?.tariff_version_id || !payload?.malo_id || !payload?.company_name) {
        return { ok: false, class: 'VALIDATION_REJECT', reasonCode: 'INVALID_CUSTOMER_DATA' };
      }
      if (payload.malo_id === payload.meter_number) {
        return { ok: false, class: 'VALIDATION_REJECT', reasonCode: 'IDENTIFIER_TYPE_COLLAPSE' };
      }
      return { ok: true, class: 'VALID' };
    },
    async submitSwitch({ payload, idempotencyKey }) {
      requireNoLive();
      const key = String(idempotencyKey || '');
      store.submitCountByKey.set(key, (store.submitCountByKey.get(key) || 0) + 1);
      if (store.orders.has(key)) {
        const existing = store.orders.get(key);
        return { ...existing, duplicate: true, providerCalls: 1 };
      }
      if (store.mode === 'SUBMIT_TIMEOUT_UNKNOWN') {
        return { ok: false, class: 'SUBMIT_TIMEOUT_UNKNOWN', code: 'TIMEOUT', providerCalls: 1 };
      }
      if (store.mode === 'SUBMIT_TRANSIENT_KNOWN_NOT_EXECUTED') {
        return {
          ok: false,
          class: 'SUBMIT_TRANSIENT_KNOWN_NOT_EXECUTED',
          code: 'TRANSIENT',
          providerCalls: 1,
        };
      }
      if (store.mode === 'SUBMIT_PERMANENT_REJECT' || store.mode === 'INVALID_MALO') {
        return {
          ok: false,
          class: 'SUBMIT_PERMANENT_REJECT',
          reasonCode: store.mode === 'INVALID_MALO' ? 'INVALID_MALO_ID' : 'PROVIDER_INTERNAL_REJECT',
          providerCalls: 1,
        };
      }
      if (store.mode === 'DUPLICATE_ORDER') {
        return {
          ok: false,
          class: 'SUBMIT_PERMANENT_REJECT',
          reasonCode: 'DUPLICATE_ORDER',
          providerCalls: 1,
        };
      }
      if (store.mode === 'TARIFF_UNAVAILABLE') {
        return {
          ok: false,
          class: 'SUBMIT_PERMANENT_REJECT',
          reasonCode: 'TARIFF_UNAVAILABLE',
          providerCalls: 1,
        };
      }
      const providerOrderId = `testord_${randomUUID()}`;
      const record = {
        ok: true,
        class: 'SUBMIT_ACCEPTED',
        providerOrderId,
        status: 'PENDING',
        productRef: payload.tariff_version_id,
        supplyPointCount: payload.supply_point_count,
        requestedStart: payload.requested_start || null,
        confirmedStart: null,
        payload,
        providerCalls: 1,
      };
      store.orders.set(key, record);
      return record;
    },
    async getSubmission({ idempotencyKey, providerOrderId }) {
      requireNoLive();
      let rec = null;
      if (idempotencyKey && store.orders.has(idempotencyKey)) rec = store.orders.get(idempotencyKey);
      else if (providerOrderId) {
        rec = [...store.orders.values()].find((o) => o.providerOrderId === providerOrderId) || null;
      }
      if (store.mode === 'READBACK_NOT_FOUND') {
        return { ok: true, class: 'READBACK_NOT_FOUND' };
      }
      if (!rec) return { ok: true, class: 'READBACK_NOT_FOUND' };
      if (store.mode === 'READBACK_PENDING') {
        return { ok: true, class: 'READBACK_PENDING', order: { ...rec, status: 'PENDING' } };
      }
      if (store.mode === 'READBACK_REJECTED') {
        return {
          ok: true,
          class: 'READBACK_REJECTED',
          order: { ...rec, status: 'REJECTED', reasonCode: 'PROVIDER_INTERNAL_REJECT' },
        };
      }
      if (store.mode === 'READBACK_MISMATCH') {
        return {
          ok: true,
          class: 'READBACK_MISMATCH',
          order: { ...rec, status: 'CONFIRMED', productRef: 'OTHER-TARIFF', confirmedStart: rec.requestedStart },
        };
      }
      if (store.mode === 'READBACK_CONFIRMED' || store.mode === 'ACCEPT') {
        const confirmedStart = rec.requestedStart || '2026-10-15';
        return {
          ok: true,
          class: 'READBACK_CONFIRMED',
          order: {
            ...rec,
            status: 'CONFIRMED',
            confirmedStart,
            productRef: rec.productRef,
          },
        };
      }
      return { ok: true, class: 'READBACK_FOUND', order: rec };
    },
    async getSwitchStatus(args) {
      return this.getSubmission(args);
    },
    async cancelSubmission() {
      return { ok: false, class: 'CANCEL_UNSUPPORTED' };
    },
  };
}
