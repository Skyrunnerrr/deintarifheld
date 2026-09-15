/**
 * Cron gate. CRON_SECRET only — LEADS_ADMIN_SECRET must never authorize cron.
 */
import { usableOpsSecret, safeEqualString } from './secret-compare.js'

export function cronSecret() {
  return usableOpsSecret(process.env.CRON_SECRET)
}

export function isCronAuthorized(request) {
  const secret = cronSecret()
  if (!secret) return false

  const auth = request.headers.get('authorization') || ''
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (bearer && safeEqualString(bearer, secret)) return true

  const header = request.headers.get('x-cron-secret') || ''
  if (header && safeEqualString(header.trim(), secret)) return true

  return false
}
