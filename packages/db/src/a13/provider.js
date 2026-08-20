/**
 * DeterministicTestAcquisitionProvider — no network. LIVE_AD=0.
 */
import { randomUUID } from 'node:crypto';
import {
  A13_TEST_PROVIDER_ID,
  A13_TEST_PROVIDER_ACCOUNT,
  LIVE_AD_PROVIDER_CALLS,
  LIVE_AD_SPEND_EUR,
  AcquisitionProviderMode,
} from '@deintarifheld/shared';
import { bumpA13Invariant } from './invariants.js';

const store = {
  mode: AcquisitionProviderMode.CREATE_ACCEPTED,
  liveCalls: 0,
  campaigns: new Map(), // idempotencyKey -> record
  byProviderId: new Map(),
  createCountByKey: new Map(),
  activateCountByKey: new Map(),
  metrics: new Map(),
};

export function resetAcquisitionProviderTestStore() {
  store.mode = AcquisitionProviderMode.CREATE_ACCEPTED;
  store.liveCalls = 0;
  store.campaigns.clear();
  store.byProviderId.clear();
  store.createCountByKey.clear();
  store.activateCountByKey.clear();
  store.metrics.clear();
}

export function setAcquisitionProviderTestMode(mode) {
  store.mode = mode;
}

export function getAcquisitionProviderLiveCallCount() {
  return store.liveCalls;
}

export function getAcquisitionProviderCreateCount(key) {
  return store.createCountByKey.get(key) || 0;
}

export function getAcquisitionProviderActivateCount(key) {
  return store.activateCountByKey.get(key) || 0;
}

function requireNoLive() {
  if (LIVE_AD_PROVIDER_CALLS !== 0 || LIVE_AD_SPEND_EUR !== 0) {
    throw new Error('LIVE_AD_FORBIDDEN');
  }
  if (store.mode === AcquisitionProviderMode.FORCE_LIVE) {
    store.liveCalls += 1;
    bumpA13Invariant('LIVE_AD_PROVIDER_CALLS');
    throw new Error('LIVE_AD_PROVIDER_FORBIDDEN_IN_E2');
  }
}

export function createDeterministicTestAcquisitionProvider(overrides = {}) {
  return {
    code: A13_TEST_PROVIDER_ID,
    accountRef: A13_TEST_PROVIDER_ACCOUNT,

    async validateCampaign(input) {
      requireNoLive();
      if (overrides.validate) return overrides.validate(input);
      if (!input?.destination) return { ok: false, class: 'VALIDATION_REJECT', code: 'DESTINATION_REQUIRED' };
      return { ok: true, class: 'VALID', providerCalls: 1 };
    },

    async createCampaign({ idempotencyKey, budgetHash, accountRef, destination, totalBudgetMicroEur }) {
      requireNoLive();
      const key = String(idempotencyKey || '');
      store.createCountByKey.set(key, (store.createCountByKey.get(key) || 0) + 1);
      if (store.campaigns.has(key)) {
        const existing = store.campaigns.get(key);
        return { ...existing, duplicate: true, providerCalls: 1 };
      }
      if (overrides.create) {
        return overrides.create({ idempotencyKey, budgetHash, accountRef, destination, totalBudgetMicroEur });
      }
      if (store.mode === AcquisitionProviderMode.CREATE_TIMEOUT_UNKNOWN) {
        return { ok: false, class: 'CREATE_TIMEOUT_UNKNOWN', code: 'TIMEOUT', providerCalls: 1 };
      }
      if (store.mode === AcquisitionProviderMode.CREATE_TRANSIENT_KNOWN_NOT_EXECUTED) {
        return {
          ok: false,
          class: 'CREATE_TRANSIENT_KNOWN_NOT_EXECUTED',
          code: 'TRANSIENT',
          providerCalls: 1,
        };
      }
      if (store.mode === AcquisitionProviderMode.CREATE_REJECTED) {
        return { ok: false, class: 'CREATE_REJECTED', reasonCode: 'PROVIDER_REJECTED', providerCalls: 1 };
      }
      const providerCampaignId = `testcamp_${randomUUID()}`;
      const record = {
        ok: true,
        class: 'CREATE_ACCEPTED',
        providerCampaignId,
        accountRef: accountRef || A13_TEST_PROVIDER_ACCOUNT,
        budgetHash,
        destination,
        totalBudgetMicroEur: String(totalBudgetMicroEur || 0),
        status: 'CREATED',
        spendMicroEur: '0',
        providerCalls: 1,
      };
      store.campaigns.set(key, record);
      store.byProviderId.set(providerCampaignId, { ...record, idempotencyKey: key });
      store.metrics.set(providerCampaignId, {
        impressions: 100,
        clicks: 5,
        spendMicroEur: '0',
      });
      return record;
    },

    async activateCampaign({ idempotencyKey, providerCampaignId }) {
      requireNoLive();
      const key = String(idempotencyKey || '');
      store.activateCountByKey.set(key, (store.activateCountByKey.get(key) || 0) + 1);
      if (store.mode === AcquisitionProviderMode.ACTIVATE_TIMEOUT_UNKNOWN) {
        return { ok: false, class: 'ACTIVATE_TIMEOUT_UNKNOWN', code: 'TIMEOUT', providerCalls: 1 };
      }
      if (store.mode === AcquisitionProviderMode.ACTIVATE_TRANSIENT_KNOWN_NOT_EXECUTED) {
        return {
          ok: false,
          class: 'ACTIVATE_TRANSIENT_KNOWN_NOT_EXECUTED',
          code: 'TRANSIENT',
          providerCalls: 1,
        };
      }
      if (store.mode === AcquisitionProviderMode.ACTIVATE_REJECTED) {
        return { ok: false, class: 'ACTIVATE_REJECTED', reasonCode: 'PROVIDER_REJECTED', providerCalls: 1 };
      }
      let rec = providerCampaignId ? store.byProviderId.get(providerCampaignId) : null;
      if (!rec && key) {
        rec = [...store.campaigns.values()].find((c) => c.activateKey === key) || null;
      }
      if (!rec && providerCampaignId) {
        // allow activate after create under different key map
        rec = store.byProviderId.get(providerCampaignId);
      }
      if (!rec) {
        return { ok: false, class: 'ACTIVATE_REJECTED', reasonCode: 'CAMPAIGN_NOT_FOUND', providerCalls: 1 };
      }
      rec.status = 'ACTIVE';
      rec.activateKey = key;
      store.byProviderId.set(rec.providerCampaignId, rec);
      return {
        ok: true,
        class: 'ACTIVATE_ACCEPTED',
        providerCampaignId: rec.providerCampaignId,
        status: 'ACTIVE',
        providerCalls: 1,
      };
    },

    async pauseCampaign({ providerCampaignId }) {
      requireNoLive();
      const rec = store.byProviderId.get(providerCampaignId);
      if (!rec) return { ok: false, class: 'PAUSE_REJECTED', providerCalls: 1 };
      rec.status = 'PAUSED';
      return { ok: true, class: 'PAUSE_ACCEPTED', providerCampaignId, status: 'PAUSED', providerCalls: 1 };
    },

    async getCampaign({ idempotencyKey, providerCampaignId, expectedAccountRef }) {
      requireNoLive();
      let rec = null;
      if (idempotencyKey && store.campaigns.has(idempotencyKey)) rec = store.campaigns.get(idempotencyKey);
      else if (providerCampaignId) rec = store.byProviderId.get(providerCampaignId) || null;

      if (store.mode === AcquisitionProviderMode.READBACK_NOT_FOUND) {
        return { ok: true, class: 'READBACK_NOT_FOUND', providerCalls: 1 };
      }

      if (store.mode === AcquisitionProviderMode.READBACK_MISMATCH) {
        return {
          ok: true,
          class: 'READBACK_MISMATCH',
          campaign: {
            providerCampaignId: providerCampaignId || `testcamp_mismatch_${idempotencyKey || 'x'}`,
            accountRef: 'WRONG_ACCOUNT',
            status: 'ACTIVE',
            spendMicroEur: '0',
          },
          providerCalls: 1,
        };
      }

      if (
        !rec
        && (store.mode === AcquisitionProviderMode.READBACK_FOUND)
        && (idempotencyKey || providerCampaignId)
      ) {
        const synthesizedId = providerCampaignId || `testcamp_reconciled_${idempotencyKey}`;
        rec = {
          ok: true,
          class: 'CREATE_ACCEPTED',
          providerCampaignId: synthesizedId,
          accountRef: A13_TEST_PROVIDER_ACCOUNT,
          status: 'ACTIVE',
          spendMicroEur: '0',
        };
        if (idempotencyKey) store.campaigns.set(String(idempotencyKey), rec);
        store.byProviderId.set(synthesizedId, rec);
      }

      if (!rec) return { ok: true, class: 'READBACK_NOT_FOUND', providerCalls: 1 };

      if (store.mode === AcquisitionProviderMode.READBACK_MISMATCH) {
        return {
          ok: true,
          class: 'READBACK_MISMATCH',
          campaign: { ...rec, accountRef: 'WRONG_ACCOUNT', status: 'ACTIVE' },
          providerCalls: 1,
        };
      }
      if (expectedAccountRef && rec.accountRef && rec.accountRef !== expectedAccountRef) {
        return {
          ok: true,
          class: 'READBACK_MISMATCH',
          campaign: rec,
          providerCalls: 1,
        };
      }
      if (store.mode === AcquisitionProviderMode.BUDGET_OVERSPEND) {
        return {
          ok: true,
          class: 'READBACK_FOUND',
          campaign: { ...rec, status: rec.status || 'ACTIVE', spendMicroEur: '999999999999' },
          providerCalls: 1,
        };
      }
      return {
        ok: true,
        class: 'READBACK_FOUND',
        campaign: { ...rec, status: rec.status || 'ACTIVE' },
        providerCalls: 1,
      };
    },

    async getCampaignMetrics({ providerCampaignId }) {
      requireNoLive();
      const m = store.metrics.get(providerCampaignId) || { impressions: 0, clicks: 0, spendMicroEur: '0' };
      if (store.mode === AcquisitionProviderMode.BUDGET_OVERSPEND) {
        return { ok: true, metrics: { ...m, spendMicroEur: '999999999999' }, providerCalls: 1 };
      }
      return { ok: true, metrics: m, providerCalls: 1 };
    },
  };
}
