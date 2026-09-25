import { isAdminAuthorized } from './admin-auth.js'
import { clientIp, hashClientKey } from './abuse-guard.js'
import { checkRateLimit, consumeRateLimit } from './rate-limit-provider.js'

export function adminRateLimitKey(request) {
  // Admin brute-force protection is IP-scoped. User-Agent is attacker-controlled
  // and must not create a new bucket.
  return hashClientKey(`admin|${clientIp(request)}`, '')
}

export async function enforceAdminAccess(request) {
  const rlKey = adminRateLimitKey(request)
  if (!rlKey) {
    return { ok: false, status: 429, code: 'too-many-requests', headers: { 'Retry-After': '60' } }
  }
  const limited = await checkRateLimit(rlKey, 'admin')
  if (!limited.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'too-many-requests',
      headers: { 'Retry-After': String(limited.retryAfter ?? 60) },
    }
  }
  if (!isAdminAuthorized(request)) {
    const consumed = await consumeRateLimit(rlKey, 'admin')
    if (!consumed.allowed) {
      return {
        ok: false,
        status: 429,
        code: 'too-many-requests',
        headers: { 'Retry-After': String(consumed.retryAfter ?? 60) },
      }
    }
    return { ok: false, status: 401, code: 'unauthorized' }
  }
  return { ok: true }
}
