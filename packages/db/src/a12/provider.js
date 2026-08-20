/**
 * DeterministicTestPublishingProvider — no network. LIVE_SOCIAL=0.
 */
import { randomUUID } from 'node:crypto';
import { A12_TEST_PUBLISHER_ID, LIVE_SOCIAL_PROVIDER_CALLS } from '@deintarifheld/shared';

const store = {
  mode: 'PUBLISH_ACCEPTED',
  liveCalls: 0,
  posts: new Map(),
  publishCountByKey: new Map(),
  metrics: new Map(),
};

export function resetContentPublisherTestStore() {
  store.mode = 'PUBLISH_ACCEPTED';
  store.liveCalls = 0;
  store.posts.clear();
  store.publishCountByKey.clear();
  store.metrics.clear();
}

export function setContentPublisherTestMode(mode) {
  store.mode = mode;
}

export function getContentPublisherLiveCallCount() {
  return store.liveCalls;
}

export function getContentPublisherPublishCount(key) {
  return store.publishCountByKey.get(key) || 0;
}

function requireNoLive() {
  if (LIVE_SOCIAL_PROVIDER_CALLS !== 0) throw new Error('LIVE_SOCIAL_FORBIDDEN');
  if (store.mode === 'FORCE_LIVE') {
    store.liveCalls += 1;
    throw new Error('LIVE_SOCIAL_PROVIDER_FORBIDDEN_IN_E2');
  }
}

export function createDeterministicTestPublishingProvider(overrides = {}) {
  return {
    code: A12_TEST_PUBLISHER_ID,
    async publishPost({ channel, plaintext, idempotencyKey, contentHash }) {
      requireNoLive();
      const key = String(idempotencyKey || '');
      store.publishCountByKey.set(key, (store.publishCountByKey.get(key) || 0) + 1);
      if (store.posts.has(key)) {
        const existing = store.posts.get(key);
        return { ...existing, duplicate: true, providerCalls: 1 };
      }
      if (overrides.publish) return overrides.publish({ channel, plaintext, idempotencyKey, contentHash });
      if (store.mode === 'PUBLISH_TIMEOUT_UNKNOWN') {
        return { ok: false, class: 'PUBLISH_TIMEOUT_UNKNOWN', code: 'TIMEOUT', providerCalls: 1 };
      }
      if (store.mode === 'PUBLISH_TRANSIENT_KNOWN_NOT_EXECUTED') {
        return {
          ok: false,
          class: 'PUBLISH_TRANSIENT_KNOWN_NOT_EXECUTED',
          code: 'TRANSIENT',
          providerCalls: 1,
        };
      }
      if (store.mode === 'PUBLISH_REJECTED') {
        return {
          ok: false,
          class: 'PUBLISH_REJECTED',
          reasonCode: 'PROVIDER_REJECTED',
          providerCalls: 1,
        };
      }
      const providerPostId = `testpost_${randomUUID()}`;
      const record = {
        ok: true,
        class: 'PUBLISH_ACCEPTED',
        providerPostId,
        channel,
        contentHash,
        status: 'PENDING',
        plaintext,
        providerCalls: 1,
      };
      store.posts.set(key, record);
      store.metrics.set(providerPostId, { impressions: 10, clicks: 1, engagement: 2 });
      return record;
    },
    async getPost({ idempotencyKey, providerPostId, expectedChannel }) {
      requireNoLive();
      let rec = null;
      if (idempotencyKey && store.posts.has(idempotencyKey)) rec = store.posts.get(idempotencyKey);
      else if (providerPostId) {
        rec = [...store.posts.values()].find((p) => p.providerPostId === providerPostId) || null;
      }
      if (store.mode === 'READBACK_NOT_FOUND' || store.mode === 'POST_REMOVED') {
        return { ok: true, class: 'READBACK_NOT_FOUND', providerCalls: 1 };
      }
      // Timeout / unknown: provider may later confirm a post that was never stored locally.
      if (
        !rec
        && (store.mode === 'READBACK_FOUND' || store.mode === 'POST_PUBLISHED')
        && (idempotencyKey || providerPostId)
      ) {
        const synthesizedId = providerPostId || `testpost_reconciled_${idempotencyKey}`;
        rec = {
          ok: true,
          class: 'PUBLISH_ACCEPTED',
          providerPostId: synthesizedId,
          channel: expectedChannel || null,
          status: 'PUBLISHED',
          providerCalls: 1,
        };
        if (idempotencyKey) store.posts.set(String(idempotencyKey), rec);
        if (!store.metrics.has(synthesizedId)) {
          store.metrics.set(synthesizedId, { impressions: 5, clicks: 0, engagement: 1 });
        }
      }
      if (!rec) return { ok: true, class: 'READBACK_NOT_FOUND', providerCalls: 1 };
      if (store.mode === 'READBACK_MISMATCH') {
        return {
          ok: true,
          class: 'READBACK_MISMATCH',
          post: { ...rec, channel: 'WRONG_CHANNEL', status: 'PUBLISHED' },
          providerCalls: 1,
        };
      }
      if (expectedChannel && rec.channel && rec.channel !== expectedChannel) {
        return {
          ok: true,
          class: 'READBACK_MISMATCH',
          post: rec,
          providerCalls: 1,
        };
      }
      if (store.mode === 'READBACK_FOUND' || store.mode === 'POST_PUBLISHED' || store.mode === 'PUBLISH_ACCEPTED') {
        return {
          ok: true,
          class: 'READBACK_FOUND',
          post: { ...rec, status: 'PUBLISHED', channel: rec.channel || expectedChannel },
          providerCalls: 1,
        };
      }
      return { ok: true, class: 'READBACK_FOUND', post: rec, providerCalls: 1 };
    },
    async getMetrics({ providerPostId }) {
      requireNoLive();
      const m = store.metrics.get(providerPostId) || { impressions: 0, clicks: 0, engagement: 0 };
      return { ok: true, metrics: m, providerCalls: 1 };
    },
    async deletePost() {
      return { ok: false, class: 'DELETE_UNSUPPORTED' };
    },
  };
}
