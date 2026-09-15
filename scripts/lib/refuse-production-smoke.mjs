/**
 * CI/smoke scripts must never write real production leads or send real customer mail.
 */
export function refuseProductionTarget(baseUrl) {
  const raw = String(baseUrl || '').trim().toLowerCase()
  const allow = (process.env.ALLOW_PRODUCTION_SMOKE || '').trim().toUpperCase() === 'YES'
  const blocked =
    raw.includes('deintarifheld.de') ||
    raw.includes('deintarifheld-leads-api.vercel.app')
  if (blocked && !allow) {
    console.error('PRODUCTION_SMOKE_BLOCKED=YES')
    console.error('Set ALLOW_PRODUCTION_SMOKE=YES only for an explicit ops E2E, never in CI.')
    process.exit(2)
  }
  if ((process.env.LEADS_MAIL_MODE || 'mock').trim().toLowerCase() === 'live') {
    if ((process.env.ALLOW_CUSTOMER_MAIL || '').trim().toUpperCase() === 'YES') {
      console.error('CUSTOMER_MAIL_SMOKE_BLOCKED=YES')
      process.exit(2)
    }
  }
}
