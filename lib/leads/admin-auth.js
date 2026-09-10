/**
 * Shared admin gate for lead ops (inbox + DSGVO delete).
 * LEADS_ADMIN_SECRET only — CRON_SECRET must never authorize admin routes.
 * Never accept the secret via query string (it would land in access logs).
 */
export function adminSecret() {
  return process.env.LEADS_ADMIN_SECRET?.trim() || ''
}

export function isAdminAuthorized(request) {
  const secret = adminSecret()
  if (!secret) return false
  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  const header = request.headers.get('x-admin-secret')?.trim() || ''
  return header === secret
}
