/**
 * Shared admin gate for lead ops (inbox + DSGVO delete).
 * LEADS_ADMIN_SECRET only — CRON_SECRET must never authorize admin routes.
 * Never accept the secret via query string (it would land in access logs).
 * Production: weak/short secrets fail closed.
 */
import { usableOpsSecret, safeEqualString } from './secret-compare.js'
import { parseAdminSessionValue, readAdminCookie } from './admin-session.js'

export function adminSecret() {
  return usableOpsSecret(process.env.LEADS_ADMIN_SECRET)
}

export function isAdminAuthorized(request) {
  const secret = adminSecret()
  if (!secret) return false

  const auth = request.headers.get('authorization') || ''
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (bearer && safeEqualString(bearer, secret)) return true

  const header = request.headers.get('x-admin-secret') || ''
  if (header && safeEqualString(header.trim(), secret)) return true

  const cookie = readAdminCookie(request)
  if (cookie && parseAdminSessionValue(secret, cookie)) return true

  return false
}
