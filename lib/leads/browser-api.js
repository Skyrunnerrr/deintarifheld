/**
 * Browser-safe API URL helpers for Phase B / production static cutover.
 *
 * Canonical production env:
 *   NEXT_PUBLIC_LEADS_API_ORIGIN=https://deintarifheld-leads-api.vercel.app
 *
 * Backward compatible:
 *   NEXT_PUBLIC_LEADS_API_URL may be the origin OR a full .../api/leads[/] URL.
 *
 * Relative fallbacks (local Next API):
 *   /api/leads/ and /api/careers/
 */

const RELATIVE_LEADS = '/api/leads/'
const RELATIVE_CAREERS = '/api/careers/'

function trim(value) {
  return String(value || '').trim()
}

function stripTrailingSlashes(value) {
  return value.replace(/\/+$/, '')
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`
}

function joinOriginPath(origin, path) {
  const base = stripTrailingSlashes(origin)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${ensureTrailingSlash(normalizedPath)}`
}

/**
 * Resolve absolute API origin, or null for same-origin relative mode.
 */
export function resolveApiOrigin() {
  const originEnv = trim(process.env.NEXT_PUBLIC_LEADS_API_ORIGIN)
  if (originEnv) return stripTrailingSlashes(originEnv)

  const legacy = trim(process.env.NEXT_PUBLIC_LEADS_API_URL)
  if (!legacy) return null

  // Absolute URL: origin, or origin + /api/leads[/]
  if (/^https?:\/\//i.test(legacy)) {
    try {
      const url = new URL(legacy)
      const path = url.pathname.replace(/\/+$/, '') || ''
      if (!path || path === '') return stripTrailingSlashes(url.origin)
      if (/^\/api\/leads$/i.test(path)) return stripTrailingSlashes(url.origin)
      // Reject malformed absolute values that would create //api or duplicated paths
      return stripTrailingSlashes(legacy.replace(/\/api\/leads\/?$/i, ''))
    } catch {
      return stripTrailingSlashes(legacy.replace(/\/api\/leads\/?$/i, ''))
    }
  }

  // Relative legacy like "/api/leads" → relative mode
  if (/^\/api\/leads\/?$/i.test(legacy)) return null

  return stripTrailingSlashes(legacy.replace(/\/api\/leads\/?$/i, ''))
}

export function leadsApiUrl() {
  const origin = resolveApiOrigin()
  if (!origin) return RELATIVE_LEADS
  return joinOriginPath(origin, '/api/leads')
}

export function careersApiUrl() {
  const origin = resolveApiOrigin()
  if (!origin) return RELATIVE_CAREERS
  return joinOriginPath(origin, '/api/careers')
}

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `dth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function postJsonLead(url, payload, { idempotencyKey } = {}) {
  const key = idempotencyKey || newIdempotencyKey()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(payload),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { res, json, idempotencyKey: key }
}
