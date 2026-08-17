/**
 * A4 email provider adapter boundary.
 * E2: mock/fail/unknown only — LIVE_PROVIDER_CALLS=0.
 * Resend live adapter gated; not used in tests.
 */
import { createHash, randomUUID } from 'node:crypto';

const store = {
  sent: new Map(), // idempotencyKey -> result
  received: new Map(), // providerEmailId -> full email
  mode: 'ACCEPT', // ACCEPT | FAIL | TIMEOUT_UNKNOWN
  liveCalls: 0,
};

export function resetProviderTestStore() {
  store.sent.clear();
  store.received.clear();
  store.mode = 'ACCEPT';
  store.liveCalls = 0;
}

export function setProviderTestMode(mode) {
  store.mode = mode;
}

export function getProviderLiveCallCount() {
  return store.liveCalls;
}

export function seedReceivedEmail(providerEmailId, email) {
  store.received.set(providerEmailId, email);
}

/**
 * Test/mock adapter — no network.
 */
export function createMockEmailProvider(overrides = {}) {
  return {
    name: 'resend_test',
    async sendEmail({ to, from, subject, text, idempotencyKey }) {
      if (overrides.forceLive) {
        store.liveCalls += 1;
        throw new Error('LIVE_PROVIDER_FORBIDDEN_IN_E2');
      }
      if (store.sent.has(idempotencyKey)) {
        return { ...store.sent.get(idempotencyKey), duplicate: true };
      }
      if (store.mode === 'FAIL') {
        return { ok: false, class: 'PERMANENT_FAILURE', code: 'MOCK_FAIL' };
      }
      if (store.mode === 'TIMEOUT_UNKNOWN') {
        return { ok: false, class: 'OUTCOME_UNKNOWN', code: 'MOCK_TIMEOUT' };
      }
      const providerMessageId = `mock_${randomUUID()}`;
      const result = {
        ok: true,
        class: 'PROVIDER_ACCEPTED',
        providerMessageId,
        to,
        from,
        subject,
        text,
      };
      store.sent.set(idempotencyKey, result);
      return result;
    },
    async retrieveReceivedEmail(providerEmailId) {
      const email = store.received.get(providerEmailId);
      if (!email) {
        if (store.mode === 'RETRIEVE_FAIL_TRANSIENT') {
          return { ok: false, transient: true, code: 'RETRIEVE_TRANSIENT' };
        }
        return { ok: false, permanent: true, code: 'EMAIL_NOT_FOUND' };
      }
      return { ok: true, email };
    },
    verifyWebhook({ payload, headers, webhookSecret }) {
      // Test verifier: accept when secret matches and header signature === sha256(payload+secret)
      if (!webhookSecret) throw new Error('WEBHOOK_SECRET_MISSING');
      const sig = headers?.signature || headers?.['svix-signature'];
      const expected = createHash('sha256').update(String(payload) + webhookSecret).digest('hex');
      if (sig !== `v1,${expected}`) throw new Error('INVALID_WEBHOOK_SIGNATURE');
      return JSON.parse(String(payload));
    },
  };
}

/**
 * Live Resend adapter — NEVER called in A4 E2 tests.
 * Implemented for staging readiness; requires explicit env gate.
 */
export function createResendEmailProvider({ apiKey, webhookSecret, ResendCtor }) {
  if (!apiKey) throw new Error('RESEND_API_KEY_REQUIRED');
  const resend = new ResendCtor(apiKey);
  return {
    name: 'resend',
    async sendEmail({ to, from, subject, text, html, idempotencyKey }) {
      store.liveCalls += 1;
      const { data, error } = await resend.emails.send(
        { from, to: [to], subject, text, html },
        { idempotencyKey },
      );
      if (error) {
        return { ok: false, class: 'PERMANENT_FAILURE', code: error.name || 'RESEND_ERROR', detail: String(error.message || '').slice(0, 120) };
      }
      return { ok: true, class: 'PROVIDER_ACCEPTED', providerMessageId: data?.id || null };
    },
    async retrieveReceivedEmail(providerEmailId) {
      store.liveCalls += 1;
      const { data, error } = await resend.emails.receiving.get(providerEmailId);
      if (error) return { ok: false, transient: true, code: 'RESEND_RETRIEVE_FAIL' };
      return {
        ok: true,
        email: {
          providerEmailId,
          from: data.from,
          to: data.to,
          subject: data.subject,
          text: data.text || '',
          html: data.html || '',
          headers: data.headers || {},
          attachments: data.attachments || [],
        },
      };
    },
    verifyWebhook({ payload, headers, webhookSecret: secret }) {
      const s = secret || webhookSecret;
      if (!s) throw new Error('WEBHOOK_SECRET_MISSING');
      return resend.webhooks.verify({
        payload,
        headers: {
          id: headers.id || headers['svix-id'],
          timestamp: headers.timestamp || headers['svix-timestamp'],
          signature: headers.signature || headers['svix-signature'],
        },
        webhookSecret: s,
      });
    },
  };
}

export function hashEmail(email) {
  return createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
}

export function redactEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  const at = s.indexOf('@');
  if (at < 1) return '[redacted]';
  return `${s[0]}***@${s.slice(at + 1)}`;
}
