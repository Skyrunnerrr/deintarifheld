/**
 * Runtime classification for fail-closed production controls.
 * NODE_ENV=production is not used: `next build` / CI set it without meaning "live API".
 */
export function isProductionRuntime() {
  return (
    process.env.VERCEL_ENV === 'production' || process.env.LEADS_RUNTIME_ENV === 'production'
  )
}

export function productionSiteOrigins() {
  return ['https://deintarifheld.de', 'https://www.deintarifheld.de']
}

export function localDevOrigins() {
  return ['http://localhost:3000', 'http://127.0.0.1:3000']
}

function parseOriginList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function isLoopbackOrigin(origin) {
  try {
    const host = new URL(origin).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin)
  }
}

/**
 * Exact origins only. Production never auto-allows localhost, even if env lists it.
 */
export function effectiveAllowedOrigins() {
  const configured = parseOriginList(process.env.LEADS_ALLOWED_ORIGINS)
  const base = isProductionRuntime()
    ? productionSiteOrigins()
    : [...productionSiteOrigins(), ...localDevOrigins()]
  const merged = [...new Set([...base, ...configured])]
  if (isProductionRuntime()) {
    return merged.filter((origin) => !isLoopbackOrigin(origin))
  }
  return merged
}

export function originFromUrl(value) {
  try {
    const u = new URL(value)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export function isAllowlistedOriginValue(value) {
  const origin = originFromUrl(value) || (value && /^https?:\/\/[^/]+$/i.test(value) ? value : null)
  if (!origin) return false
  return effectiveAllowedOrigins().some((allowed) => allowed.toLowerCase() === origin.toLowerCase())
}
