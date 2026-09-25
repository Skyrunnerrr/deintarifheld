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

export function hasJsonContentType(request) {
  const contentType = request.headers.get('content-type')?.trim().toLowerCase() || ''
  return /^application\/json(?:\s*;|$)/.test(contentType)
}
