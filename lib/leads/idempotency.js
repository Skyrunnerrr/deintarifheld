import { createHash } from 'crypto'

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const key of Object.keys(value).sort()) {
    if (key === '_formLoadedAt') continue
    out[key] = canonicalize(value[key])
  }
  return out
}

export function normalizeIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : ''
  if (key.length < 8 || key.length > 128) return ''
  return key
}

/**
 * Prefer the caller's stable idempotency key. For old/manual clients that do
 * not send one, derive a one-minute fallback from the actual normalized
 * payload rather than email alone, so an edited submission is not discarded.
 */
export function buildIdempotencyKey(request, data, { scope = 'lead', now = Date.now() } = {}) {
  const supplied = normalizeIdempotencyKey(request?.headers?.get?.('idempotency-key'))
  if (supplied) return supplied

  const minuteWindow = Math.floor(now / 60_000)
  const canonical = JSON.stringify(canonicalize(data || {}))
  return createHash('sha256')
    .update(`${scope}|${minuteWindow}|${canonical}`)
    .digest('hex')
    .slice(0, 48)
}
