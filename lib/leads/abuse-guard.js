import { createHash } from 'crypto'

/** Best-effort in-memory rate limiting (per serverless instance). Averion pattern. */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_SUBMITS = 5
const RATE_LIMIT_MAX_ERRORS = 20
export const MIN_SUBMIT_MS = 3000

const buckets = new Map()

/** Exact-origin patterns only — no wildcard *.vercel.app */
const DEFAULT_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?deintarifheld\.de$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
]

function allowedOriginPatterns() {
  const extra = (process.env.LEADS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!extra.length) return DEFAULT_ORIGIN_PATTERNS
  return [
    ...DEFAULT_ORIGIN_PATTERNS,
    ...extra.map((origin) => {
      const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`^${escaped}$`, 'i')
    }),
  ]
}

function originFromUrl(value) {
  try {
    const u = new URL(value)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function isAllowedOriginUrl(value) {
  const origin = originFromUrl(value)
  if (!origin) return false
  return allowedOriginPatterns().some((pattern) => pattern.test(origin))
}

export function hashClientKey(ip, userAgent) {
  const salt = process.env.LEADS_RATE_LIMIT_SALT || 'dth-leads-rl-v1'
  return createHash('sha256')
    .update(`${salt}|${ip}|${String(userAgent || '').slice(0, 120)}`)
    .digest('hex')
}

export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function pruneBucket(bucket, now) {
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  bucket.submits = bucket.submits.filter((t) => t > cutoff)
  bucket.errors = bucket.errors.filter((t) => t > cutoff)
}

function getBucket(key) {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { submits: [], errors: [] }
    buckets.set(key, bucket)
  }
  return bucket
}

export function checkRateLimit(key, kind) {
  const now = Date.now()
  const bucket = getBucket(key)
  pruneBucket(bucket, now)

  const events = kind === 'submit' ? bucket.submits : bucket.errors
  const max = kind === 'submit' ? RATE_LIMIT_MAX_SUBMITS : RATE_LIMIT_MAX_ERRORS
  if (events.length < max) return { allowed: true }

  const oldest = events[0] ?? now
  const retryAfter = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000))
  return { allowed: false, retryAfter }
}

export function recordRateLimit(key, kind) {
  const now = Date.now()
  const bucket = getBucket(key)
  pruneBucket(bucket, now)
  if (kind === 'submit') bucket.submits.push(now)
  else bucket.errors.push(now)
}

export function isBlockedOrigin(request) {
  const origin = request.headers.get('origin')?.trim()
  const referer = request.headers.get('referer')?.trim()

  if (!origin && !referer) return false
  if (origin && !isAllowedOriginUrl(origin)) return true
  if (referer && !isAllowedOriginUrl(referer)) return true
  return false
}

export function isTooFastSubmit(formLoadedAt) {
  if (formLoadedAt == null || formLoadedAt === '') return false
  const started = typeof formLoadedAt === 'number' ? formLoadedAt : Number(formLoadedAt)
  if (!Number.isFinite(started) || started <= 0) return false
  return Date.now() - started < MIN_SUBMIT_MS
}

export function hasJsonContentType(request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() || ''
  return contentType.includes('application/json')
}

export function resetRateLimitsForTests() {
  buckets.clear()
}
