/**
 * P4-H0b4 — provider-subject session lifecycle without person mapping.
 * Enforces inactivity / absolute max / REVOKE_OLD_ALLOW_NEW for external identities.
 */
import {
  SESSION_INACTIVITY_TIMEOUT_MINUTES,
  SESSION_MAXIMUM_LIFETIME_HOURS,
  MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
} from './h0a-constants.js';
import { CONCURRENT_SESSION_POLICY } from './session-policy.js';
import { TokenErrorCode, fail } from './token-errors.js';

function subjectKey(identity) {
  return `${identity.provider}|${identity.issuer}|${identity.subject}`;
}

/**
 * In-memory registry keyed by provider identity (not DTH person).
 * Process-local only — sufficient for local CC H0b4 proofs.
 */
export function createInMemoryProviderSessionRegistry() {
  /** @type {Map<string, { activeSessionId: string|null, sessionStartedAtSeconds: number, lastActivityAtSeconds: number, revokedSessionIds: Set<string> }>} */
  const bySubject = new Map();
  return {
    kind: 'IN_MEMORY_PROVIDER_SESSION_REGISTRY',
    persistent: false,
    get(identity) {
      return bySubject.get(subjectKey(identity)) || null;
    },
    /** @internal */
    _set(identity, record) {
      bySubject.set(subjectKey(identity), record);
    },
    clear() {
      bySubject.clear();
    },
    size() {
      return bySubject.size;
    },
    activeCount(identity) {
      const r = this.get(identity);
      return r && r.activeSessionId ? 1 : 0;
    },
  };
}

/**
 * Apply H0b4 lifecycle to a validated external provider identity.
 * @param {object} opts
 * @param {object} opts.identity — ExternalProviderIdentity
 * @param {object} opts.registry
 * @param {() => number} [opts.nowSeconds]
 */
export function applyProviderSessionLifecycle({
  identity,
  registry,
  nowSeconds = () => Math.floor(Date.now() / 1000),
}) {
  if (!identity || !identity.sessionId || !identity.subject) {
    return fail(TokenErrorCode.TOKEN_SESSION_ID_MISSING);
  }
  if (!registry) {
    return fail(TokenErrorCode.SESSION_POLICY_REJECTED, 'PROVIDER_SESSION_REGISTRY_REQUIRED');
  }

  const now = nowSeconds();
  const maxAgeSeconds = SESSION_MAXIMUM_LIFETIME_HOURS * 3600;
  const inactivitySeconds = SESSION_INACTIVITY_TIMEOUT_MINUTES * 60;

  let record = registry.get(identity);
  if (!record) {
    record = {
      activeSessionId: null,
      sessionStartedAtSeconds: typeof identity.issuedAt === 'number' ? identity.issuedAt : now,
      lastActivityAtSeconds: now,
      revokedSessionIds: new Set(),
    };
  }

  if (record.revokedSessionIds.has(identity.sessionId)) {
    return fail(TokenErrorCode.SESSION_REVOKED, 'PROVIDER_SESSION_REVOKED');
  }

  if (now - record.sessionStartedAtSeconds >= maxAgeSeconds) {
    record.activeSessionId = null;
    registry._set(identity, record);
    return fail(TokenErrorCode.SESSION_MAX_LIFETIME_EXCEEDED);
  }

  if (record.activeSessionId === identity.sessionId) {
    if (now - record.lastActivityAtSeconds >= inactivitySeconds) {
      record.activeSessionId = null;
      record.revokedSessionIds.add(identity.sessionId);
      registry._set(identity, record);
      return fail(TokenErrorCode.SESSION_INACTIVITY_EXCEEDED);
    }
    record.lastActivityAtSeconds = now;
    registry._set(identity, record);
    return {
      ok: true,
      concurrentSessionPolicy: CONCURRENT_SESSION_POLICY,
      revokedSessionIds: Object.freeze([]),
      activeSessionCount: 1,
      policy: Object.freeze({
        inactivityTimeoutMinutes: SESSION_INACTIVITY_TIMEOUT_MINUTES,
        maximumLifetimeHours: SESSION_MAXIMUM_LIFETIME_HOURS,
        maxActiveSessions: MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
        concurrentSessionPolicy: CONCURRENT_SESSION_POLICY,
      }),
    };
  }

  // New or replacement session
  /** @type {string[]} */
  const revokedSessionIds = [];
  if (record.activeSessionId && record.activeSessionId !== identity.sessionId) {
    if (CONCURRENT_SESSION_POLICY !== 'REVOKE_OLD_ALLOW_NEW') {
      return fail(TokenErrorCode.SESSION_MULTI_ACTIVE_REJECTED, CONCURRENT_SESSION_POLICY);
    }
    revokedSessionIds.push(record.activeSessionId);
    record.revokedSessionIds.add(record.activeSessionId);
  }

  record.activeSessionId = identity.sessionId;
  record.sessionStartedAtSeconds = typeof identity.issuedAt === 'number' ? identity.issuedAt : now;
  record.lastActivityAtSeconds = now;
  registry._set(identity, record);

  return {
    ok: true,
    concurrentSessionPolicy: CONCURRENT_SESSION_POLICY,
    revokedSessionIds: Object.freeze(revokedSessionIds),
    activeSessionCount: 1,
    policy: Object.freeze({
      inactivityTimeoutMinutes: SESSION_INACTIVITY_TIMEOUT_MINUTES,
      maximumLifetimeHours: SESSION_MAXIMUM_LIFETIME_HOURS,
      maxActiveSessions: MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
      concurrentSessionPolicy: CONCURRENT_SESSION_POLICY,
    }),
  };
}

/**
 * Mark a session id revoked locally (after provider revocation proof).
 */
export function markProviderSessionRevoked({ identity, registry, sessionId }) {
  if (!registry || !identity) return { ok: false, code: 'REGISTRY_REQUIRED' };
  const record = registry.get(identity) || {
    activeSessionId: null,
    sessionStartedAtSeconds: 0,
    lastActivityAtSeconds: 0,
    revokedSessionIds: new Set(),
  };
  const id = sessionId || identity.sessionId;
  if (id) {
    record.revokedSessionIds.add(id);
    if (record.activeSessionId === id) record.activeSessionId = null;
  }
  registry._set(identity, record);
  return { ok: true, activeSessionCount: record.activeSessionId ? 1 : 0 };
}
