/**
 * Local session policy evaluator (injected clock).
 * P4-H0b4: concurrent conflict resolution = REVOKE_OLD_ALLOW_NEW.
 */
import {
  SESSION_INACTIVITY_TIMEOUT_MINUTES,
  SESSION_MAXIMUM_LIFETIME_HOURS,
  MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
  MULTI_SESSION_ALLOWED,
  LinkStatus,
} from './h0a-constants.js';
import { TokenErrorCode, fail } from './token-errors.js';

/** Owner-decided H0b4 concurrent policy. */
export const CONCURRENT_SESSION_POLICY = 'REVOKE_OLD_ALLOW_NEW';

/** @deprecated use CONCURRENT_SESSION_POLICY — retained export name for H0a callers */
export const PRODUCTION_CONCURRENT_SESSION_RESOLUTION = CONCURRENT_SESSION_POLICY;

export function createInMemoryActiveSessionAdapter() {
  /** @type {Map<string, { sessionId: string, dthPersonId: string }[]>} */
  const byPerson = new Map();
  return {
    kind: 'IN_MEMORY_ACTIVE_SESSION',
    persistent: false,
    listActive(dthPersonId) {
      return [...(byPerson.get(dthPersonId) || [])];
    },
    setActive(dthPersonId, sessions) {
      byPerson.set(dthPersonId, [...sessions]);
    },
    /**
     * REVOKE_OLD_ALLOW_NEW: keep only the provided session as active.
     * @returns {{ revokedSessionIds: string[] }}
     */
    replaceActive(dthPersonId, session) {
      const prev = this.listActive(dthPersonId);
      const revokedSessionIds = prev
        .map((s) => s.sessionId)
        .filter((id) => id && id !== session.sessionId);
      this.setActive(dthPersonId, [session]);
      return { revokedSessionIds };
    },
  };
}

/**
 * @param {object} input
 * @param {string} input.sessionId
 * @param {string} input.dthPersonId
 * @param {number} input.sessionStartedAtSeconds — absolute session start
 * @param {number} input.lastActivityAtSeconds
 * @param {number} input.tokenExpiresAtSeconds
 * @param {string} input.linkStatus
 * @param {object} [input.activeSessionAdapter]
 * @param {() => number} [input.nowSeconds]
 * @param {'REVOKE_OLD_ALLOW_NEW'|'REJECT_NEW'} [input.concurrentSessionPolicy]
 */
export function evaluateSessionPolicy({
  sessionId,
  dthPersonId,
  sessionStartedAtSeconds,
  lastActivityAtSeconds,
  tokenExpiresAtSeconds,
  linkStatus,
  activeSessionAdapter,
  nowSeconds = () => Math.floor(Date.now() / 1000),
  concurrentSessionPolicy = CONCURRENT_SESSION_POLICY,
}) {
  if (!sessionId) {
    return fail(TokenErrorCode.TOKEN_SESSION_ID_MISSING);
  }
  if (linkStatus === LinkStatus.DISABLED) {
    return fail(TokenErrorCode.IDENTITY_MAPPING_DISABLED);
  }
  if (linkStatus !== LinkStatus.ACTIVE) {
    return fail(TokenErrorCode.SESSION_POLICY_REJECTED);
  }

  const now = nowSeconds();
  if (typeof tokenExpiresAtSeconds === 'number' && now >= tokenExpiresAtSeconds) {
    return fail(TokenErrorCode.TOKEN_EXPIRED);
  }

  const maxAgeSeconds = SESSION_MAXIMUM_LIFETIME_HOURS * 3600;
  if (now - sessionStartedAtSeconds >= maxAgeSeconds) {
    return fail(TokenErrorCode.SESSION_MAX_LIFETIME_EXCEEDED);
  }

  const inactivitySeconds = SESSION_INACTIVITY_TIMEOUT_MINUTES * 60;
  if (now - lastActivityAtSeconds >= inactivitySeconds) {
    return fail(TokenErrorCode.SESSION_INACTIVITY_EXCEEDED);
  }

  /** @type {string[]} */
  let revokedSessionIds = [];

  if (!MULTI_SESSION_ALLOWED && activeSessionAdapter) {
    const active = activeSessionAdapter.listActive(dthPersonId);
    const existingDistinct = new Set(active.map((s) => s.sessionId).filter(Boolean));

    if (existingDistinct.size > MAX_ACTIVE_SESSIONS_PER_DTH_PERSON) {
      // Corrupt multi-active state → fail closed unless we can normalize via revoke-old.
      if (concurrentSessionPolicy !== 'REVOKE_OLD_ALLOW_NEW' || typeof activeSessionAdapter.replaceActive !== 'function') {
        return fail(TokenErrorCode.SESSION_MULTI_ACTIVE_REJECTED, concurrentSessionPolicy);
      }
    }

    const otherActive = [...existingDistinct].filter((id) => id !== sessionId);
    if (otherActive.length > 0 || (existingDistinct.size >= 1 && !existingDistinct.has(sessionId))) {
      if (concurrentSessionPolicy === 'REVOKE_OLD_ALLOW_NEW' && typeof activeSessionAdapter.replaceActive === 'function') {
        const replaced = activeSessionAdapter.replaceActive(dthPersonId, {
          sessionId,
          dthPersonId,
        });
        revokedSessionIds = replaced.revokedSessionIds || otherActive;
      } else {
        return fail(TokenErrorCode.SESSION_MULTI_ACTIVE_REJECTED, concurrentSessionPolicy);
      }
    } else if (!existingDistinct.has(sessionId)) {
      if (typeof activeSessionAdapter.replaceActive === 'function') {
        activeSessionAdapter.replaceActive(dthPersonId, { sessionId, dthPersonId });
      } else {
        activeSessionAdapter.setActive(dthPersonId, [{ sessionId, dthPersonId }]);
      }
    }
  }

  return {
    ok: true,
    revokedSessionIds: Object.freeze([...revokedSessionIds]),
    policy: Object.freeze({
      inactivityTimeoutMinutes: SESSION_INACTIVITY_TIMEOUT_MINUTES,
      maximumLifetimeHours: SESSION_MAXIMUM_LIFETIME_HOURS,
      maxActiveSessions: MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
      multiSessionAllowed: MULTI_SESSION_ALLOWED,
      concurrentSessionPolicy: CONCURRENT_SESSION_POLICY,
      productionConcurrentSessionResolution: CONCURRENT_SESSION_POLICY,
    }),
  };
}
