import { isAllowlistedOriginValue, isProductionRuntime } from './runtime-env.js'
import { safeEqualString } from './secret-compare.js'
import {
  checkRateLimit,
  consumeRateLimit,
  hashClientKey,
  recordRateLimit,
  resetRateLimitsForTests,
} from './rate-limit-provider.js'

export { checkRateLimit, consumeRateLimit, hashClientKey, recordRateLimit, resetRateLimitsForTests }

/** Minimum dwell time before a real submit is accepted. */
export const MIN_SUBMIT_MS = 3000
/** Reject stale timestamps so a captured _formLoadedAt cannot be replayed forever. */
export const MAX_FORM_AGE_MS = 6 * 60 * 60 * 1000

export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Explicit CI/preview smoke bypass. Never active in production, even if env is set.
 * Requires LEADS_ALLOW_SMOKE_BYPASS=YES and a dedicated secret header.
 */
export function hasControlledIntakeBypass(request) {
  if (isProductionRuntime()) return false
  if ((process.env.LEADS_ALLOW_SMOKE_BYPASS || '').trim().toUpperCase() !== 'YES') return false
  const expected = (process.env.LEADS_INTAKE_SMOKE_SECRET || '').trim()
  if (expected.length < 16) return false
  const provided = (request.headers.get('x-dth-intake-smoke') || '').trim()
  return safeEqualString(provided, expected)
}

export function isBrowserOriginTrusted(request) {
  const origin = request.headers.get('origin')?.trim()
  const referer = request.headers.get('referer')?.trim()
  if (!origin && !referer) return false
  if (origin && !isAllowlistedOriginValue(origin)) return false
  if (referer && !isAllowlistedOriginValue(referer)) return false
  return true
}

/**
 * Production browser POSTs must present an allowlisted Origin or Referer.
 * Missing both is untrusted. Smoke bypass is the only controlled exception.
 */
export function isBlockedOrigin(request) {
  if (hasControlledIntakeBypass(request)) return false
  return !isBrowserOriginTrusted(request)
}

export function evaluateFormTiming(formLoadedAt, now = Date.now()) {
  if (formLoadedAt == null || formLoadedAt === '') {
    return { ok: false, reason: 'missing' }
  }
  const started = typeof formLoadedAt === 'number' ? formLoadedAt : Number(formLoadedAt)
  if (!Number.isFinite(started) || started <= 0) {
    return { ok: false, reason: 'invalid' }
  }
  const elapsed = now - started
  if (elapsed < MIN_SUBMIT_MS) return { ok: false, reason: 'too-fast' }
  if (elapsed > MAX_FORM_AGE_MS) return { ok: false, reason: 'too-old' }
  return { ok: true, elapsed }
}

/** True when the submit must be treated as a bot (missing timing is no longer a no-op). */
export function isTooFastSubmit(formLoadedAt) {
  return !evaluateFormTiming(formLoadedAt).ok
}

export function hasJsonContentType(request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() || ''
  return contentType.includes('application/json')
}
