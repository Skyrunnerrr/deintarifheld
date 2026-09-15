import { isAdminAuthorized } from './admin-auth.js'
import { clientIp, hashClientKey } from './abuse-guard.js'
import { checkRateLimit, recordRateLimit } from './rate-limit-provider.js'

export function adminRateLimitKey(request) {
  return hashClientKey(`admin|${clientIp(request)}`, request.headers.get('user-agent') || 'unknown')
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
    await recordRateLimit(rlKey, 'admin')
    return { ok: false, status: 401, code: 'unauthorized' }
  }
  return { ok: true }
}
