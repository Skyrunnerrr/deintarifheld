/**
 * Local session policy evaluator (injected clock).
 * Concurrent-session conflict resolution for live Clerk is NOT implemented (H0b).
 */
import {
  SESSION_INACTIVITY_TIMEOUT_MINUTES,
  SESSION_MAXIMUM_LIFETIME_HOURS,
  MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
  MULTI_SESSION_ALLOWED,
  LinkStatus,
} from './h0a-constants.js';
import { TokenErrorCode, fail } from './token-errors.js';

export const PRODUCTION_CONCURRENT_SESSION_RESOLUTION = 'NOT_IMPLEMENTED_IN_H0A';

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
  if (now - sessionStartedAtSeconds > maxAgeSeconds) {
    return fail(TokenErrorCode.SESSION_MAX_LIFETIME_EXCEEDED);
  }

  const inactivitySeconds = SESSION_INACTIVITY_TIMEOUT_MINUTES * 60;
  if (now - lastActivityAtSeconds > inactivitySeconds) {
    return fail(TokenErrorCode.SESSION_INACTIVITY_EXCEEDED);
  }

  if (!MULTI_SESSION_ALLOWED && activeSessionAdapter) {
    const active = activeSessionAdapter.listActive(dthPersonId);
    const distinct = new Set(active.map((s) => s.sessionId));
    // Count other sessions plus this one if not already listed
    if (!distinct.has(sessionId)) {
      distinct.add(sessionId);
    }
    // If adapter already has multiple distinct sessions, or would exceed max
    if (distinct.size > MAX_ACTIVE_SESSIONS_PER_DTH_PERSON) {
      return fail(TokenErrorCode.SESSION_MULTI_ACTIVE_REJECTED, PRODUCTION_CONCURRENT_SESSION_RESOLUTION);
    }
    // Also reject if adapter reports >1 without this session (already multi)
    const existingDistinct = new Set(active.map((s) => s.sessionId));
    if (existingDistinct.size > MAX_ACTIVE_SESSIONS_PER_DTH_PERSON) {
      return fail(TokenErrorCode.SESSION_MULTI_ACTIVE_REJECTED, PRODUCTION_CONCURRENT_SESSION_RESOLUTION);
    }
    if (existingDistinct.size === 1 && !existingDistinct.has(sessionId)) {
      // One other active session exists → policy-invalid (resolution deferred to H0b)
      return fail(TokenErrorCode.SESSION_MULTI_ACTIVE_REJECTED, PRODUCTION_CONCURRENT_SESSION_RESOLUTION);
    }
  }

  return {
    ok: true,
    policy: Object.freeze({
      inactivityTimeoutMinutes: SESSION_INACTIVITY_TIMEOUT_MINUTES,
      maximumLifetimeHours: SESSION_MAXIMUM_LIFETIME_HOURS,
      maxActiveSessions: MAX_ACTIVE_SESSIONS_PER_DTH_PERSON,
      multiSessionAllowed: MULTI_SESSION_ALLOWED,
      productionConcurrentSessionResolution: PRODUCTION_CONCURRENT_SESSION_RESOLUTION,
    }),
  };
}
