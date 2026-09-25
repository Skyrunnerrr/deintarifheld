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
function validatedAbsoluteOrigin(value, { allowLeadsPath = false } = {}) {
  if (!/^https?:\/\//i.test(value)) return null
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return null
    const path = url.pathname.replace(/\/+$/, '')
    if (path && !(allowLeadsPath && /^\/api\/leads$/i.test(path))) return null
    return stripTrailingSlashes(url.origin)
  } catch {
    return null
  }
}

export function resolveApiOrigin() {
  const originEnv = trim(process.env.NEXT_PUBLIC_LEADS_API_ORIGIN)
  if (originEnv) {
    const origin = validatedAbsoluteOrigin(originEnv)
    if (!origin) throw new Error('Invalid NEXT_PUBLIC_LEADS_API_ORIGIN')
    return origin
  }

  const legacy = trim(process.env.NEXT_PUBLIC_LEADS_API_URL)
  if (!legacy) return null

  // Absolute legacy value may be the origin OR origin + /api/leads[/].
  if (/^https?:\/\//i.test(legacy)) {
    const origin = validatedAbsoluteOrigin(legacy, { allowLeadsPath: true })
    if (!origin) throw new Error('Invalid NEXT_PUBLIC_LEADS_API_URL')
    return origin
  }

  // Relative legacy like "/api/leads" → same-origin mode.
  if (/^\/api\/leads\/?$/i.test(legacy)) return null

  throw new Error('Invalid NEXT_PUBLIC_LEADS_API_URL')
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

export const DEFAULT_LEAD_POST_TIMEOUT_MS = 15_000

// Retain an idempotency key only while delivery outcome is uncertain. This means
// a user retry after a browser/network timeout reuses the same server key, while
// an edited payload gets a new key.
const pendingKeys = new Map()
const MAX_PENDING_KEYS = 32
const PENDING_KEY_TTL_MS = 30 * 60 * 1000

function prunePendingKeys(now = Date.now()) {
  for (const [fingerprint, pending] of pendingKeys) {
    if (!pending || now - pending.createdAt > PENDING_KEY_TTL_MS) {
      pendingKeys.delete(fingerprint)
    }
  }
  while (pendingKeys.size > MAX_PENDING_KEYS) {
    const oldest = pendingKeys.keys().next().value
    if (oldest === undefined) break
    pendingKeys.delete(oldest)
  }
}

function pendingKeyFor(fingerprint, now = Date.now()) {
  prunePendingKeys(now)
  return pendingKeys.get(fingerprint)?.key || ''
}

function rememberPendingKey(fingerprint, key, now = Date.now()) {
  if (!pendingKeys.has(fingerprint)) {
    pendingKeys.set(fingerprint, { key, createdAt: now })
  }
  prunePendingKeys(now)
}

const VOLATILE_FINGERPRINT_FIELDS = new Set([
  '_recaptchaToken',
  '_formLoadedAt',
  'timestamp',
])

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const key of Object.keys(value).sort()) {
    if (VOLATILE_FINGERPRINT_FIELDS.has(key)) continue
    out[key] = stableValue(value[key])
  }
  return out
}

export function leadPayloadFingerprint(url, payload) {
  return `${String(url || '')}|${JSON.stringify(stableValue(payload || {}))}`
}

function timeoutError(key) {
  const error = new Error('Lead request timed out')
  error.name = 'AbortError'
  error.code = 'request-timeout'
  error.idempotencyKey = key
  return error
}

export async function postJsonLead(
  url,
  payload,
  { idempotencyKey, timeoutMs = DEFAULT_LEAD_POST_TIMEOUT_MS } = {},
) {
  const fingerprint = leadPayloadFingerprint(url, payload)
  const key = idempotencyKey || pendingKeyFor(fingerprint) || newIdempotencyKey()
  if (!idempotencyKey) rememberPendingKey(fingerprint, key)

  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
      ...(controller ? { signal: controller.signal } : {}),
    })
  } catch (error) {
    // Keep the generated key when outcome is unknown. A retry with the same
    // logical payload will then be idempotent if the first request reached the API.
    if (controller?.signal?.aborted) throw timeoutError(key)
    if (error && typeof error === 'object') error.idempotencyKey = key
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }

  // Successful/ordinary client responses are definitive. A 5xx response can
  // still be ambiguous (the row may have committed before a downstream crash),
  // so retain the same key for a safe retry.
  if (!idempotencyKey && res.status < 500) pendingKeys.delete(fingerprint)

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { res, json, idempotencyKey: key }
}
