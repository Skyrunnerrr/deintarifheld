/**
 * Rate-limit provider abstraction.
 *
 * Providers:
 *   memory   — per-instance Map. Local / CI only. consume() is a single sync critical section.
 *   supabase — consume_rate_limit() RPC (one atomic DB op). Production default.
 *
 * Fail-safe:
 *   production + supabase error or missing backend → deny (fail-closed)
 *   non-production + supabase error → memory fallback
 *   production + memory without LEADS_ALLOW_MEMORY_RATE_LIMIT=YES → deny
 *
 * Required production env:
 *   LEADS_RATE_LIMIT_PROVIDER=supabase (default when VERCEL_ENV/LEADS_RUNTIME_ENV=production)
 *   LEADS_RATE_LIMIT_SALT=<unpredictable, not the historic default>
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   Apply supabase/migrations/003_leads_rate_limits.sql, 004_consume_rate_limit.sql,
 *   and 005_legal_hold_and_rate_limit_invoker.sql before production API deploy.
 */
import { createHash } from 'crypto'
import { getServiceSupabase } from './supabase.js'
import { isProductionRuntime } from './runtime-env.js'
import { leadsLog } from './log.js'

export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const RATE_LIMIT_WINDOW_SECONDS = 10 * 60
export const RATE_LIMIT_MAX_SUBMITS = 5
export const RATE_LIMIT_MAX_ERRORS = 20
export const RATE_LIMIT_MAX_ADMIN = 5

const memoryBuckets = new Map()
let testSupabaseClient = null

function maxForKind(kind) {
  if (kind === 'submit') return RATE_LIMIT_MAX_SUBMITS
  if (kind === 'admin') return RATE_LIMIT_MAX_ADMIN
  return RATE_LIMIT_MAX_ERRORS
}

export function rateLimitSalt() {
  const salt = process.env.LEADS_RATE_LIMIT_SALT?.trim()
  if (salt) return salt
  if (isProductionRuntime()) return ''
  return 'dth-leads-rl-dev-only'
}

export function hashClientKey(ip, userAgent) {
  const salt = rateLimitSalt()
  if (!salt) {
    return ''
  }
  return createHash('sha256')
    .update(`${salt}|${ip}|${String(userAgent || '').slice(0, 120)}`)
    .digest('hex')
}

function pruneBucket(bucket, now) {
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  bucket.submits = bucket.submits.filter((t) => t > cutoff)
  bucket.errors = bucket.errors.filter((t) => t > cutoff)
  bucket.admin = (bucket.admin || []).filter((t) => t > cutoff)
}

function memoryGet(key) {
  let bucket = memoryBuckets.get(key)
  if (!bucket) {
    bucket = { submits: [], errors: [], admin: [] }
    memoryBuckets.set(key, bucket)
  }
  return bucket
}

function memoryEvents(bucket, kind) {
  if (kind === 'submit') return bucket.submits
  if (kind === 'admin') return bucket.admin
  return bucket.errors
}

export function memoryCheckRateLimit(key, kind) {
  const now = Date.now()
  const bucket = memoryGet(key)
  pruneBucket(bucket, now)
  const events = memoryEvents(bucket, kind)
  const max = maxForKind(kind)
  if (events.length < max) return { allowed: true, hitCount: events.length, provider: 'memory' }
  const oldest = events[0] ?? now
  const retryAfter = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000))
  return { allowed: false, retryAfter, hitCount: events.length, provider: 'memory' }
}

/** Atomic for the Node event loop: increment then evaluate with no await in between. */
export function memoryConsumeRateLimit(key, kind) {
  const now = Date.now()
  const bucket = memoryGet(key)
  pruneBucket(bucket, now)
  const events = memoryEvents(bucket, kind)
  const max = maxForKind(kind)
  events.push(now)
  const hitCount = events.length
  if (hitCount > max) {
    const oldest = events[0] ?? now
    const retryAfter = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfter, hitCount, provider: 'memory' }
  }
  return { allowed: true, retryAfter: 0, hitCount, provider: 'memory' }
}

export function memoryRecordRateLimit(key, kind) {
  memoryConsumeRateLimit(key, kind)
}

export function resetRateLimitsForTests() {
  memoryBuckets.clear()
}

export function setRateLimitSupabaseForTests(client) {
  testSupabaseClient = client
}

function denied(reason, retryAfter = 60) {
  return { allowed: false, retryAfter, reason, provider: 'fail-closed', hitCount: 0 }
}

export function resolveRateLimitProviderName() {
  const explicit = (process.env.LEADS_RATE_LIMIT_PROVIDER || '').trim().toLowerCase()
  if (explicit === 'memory' || explicit === 'supabase') return explicit
  return isProductionRuntime() ? 'supabase' : 'memory'
}

function resolveSupabase() {
  if (testSupabaseClient) return testSupabaseClient
  return getServiceSupabase()
}

function rowFromRpc(data) {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  return row
}

async function supabaseConsume(key, kind) {
  const supabase = resolveSupabase()
  if (!supabase) {
    if (isProductionRuntime()) return denied('rate-limit-backend-unavailable')
    return memoryConsumeRateLimit(key, kind)
  }
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_bucket_key: key,
    p_kind: kind,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max_hits: maxForKind(kind),
  })
  if (error || !rowFromRpc(data)) {
    leadsLog('error', 'rate_limit.supabase_consume_failed', { code: 'rate-limit-backend-error' })
    if (isProductionRuntime()) return denied('rate-limit-backend-error')
    return memoryConsumeRateLimit(key, kind)
  }
  const row = rowFromRpc(data)
  const allowed = row.allowed === true
  const retryAfter = allowed ? 0 : Math.max(1, Number(row.retry_after) || 60)
  return {
    allowed,
    retryAfter,
    hitCount: Number(row.hit_count) || 0,
    provider: 'supabase',
  }
}

async function supabaseCheck(key, kind) {
  const supabase = resolveSupabase()
  if (!supabase) {
    if (isProductionRuntime()) return denied('rate-limit-backend-unavailable')
    return memoryCheckRateLimit(key, kind)
  }
  const { data, error } = await supabase
    .from('intake_rate_limits')
    .select('window_started_at, hit_count')
    .eq('bucket_key', key)
    .eq('kind', kind)
    .maybeSingle()
  if (error) {
    leadsLog('error', 'rate_limit.supabase_check_failed', { code: 'rate-limit-backend-error' })
    if (isProductionRuntime()) return denied('rate-limit-backend-error')
    return memoryCheckRateLimit(key, kind)
  }
  if (!data) return { allowed: true, hitCount: 0, provider: 'supabase' }
  const started = new Date(data.window_started_at).getTime()
  const now = Date.now()
  if (!Number.isFinite(started) || now - started >= RATE_LIMIT_WINDOW_MS) {
    return { allowed: true, hitCount: 0, provider: 'supabase' }
  }
  const hitCount = data.hit_count || 0
  if (hitCount >= maxForKind(kind)) {
    const retryAfter = Math.max(1, Math.ceil((started + RATE_LIMIT_WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfter, hitCount, provider: 'supabase' }
  }
  return { allowed: true, hitCount, provider: 'supabase' }
}

export async function checkRateLimit(key, kind) {
  if (!key) return denied('rate-limit-salt-missing')
  const name = resolveRateLimitProviderName()
  if (name === 'memory') {
    if (isProductionRuntime() && (process.env.LEADS_ALLOW_MEMORY_RATE_LIMIT || '').trim().toUpperCase() !== 'YES') {
      return denied('rate-limit-memory-forbidden-in-production')
    }
    return memoryCheckRateLimit(key, kind)
  }
  if (name === 'supabase') {
    return supabaseCheck(key, kind)
  }
  return denied('rate-limit-provider-unknown')
}

export async function consumeRateLimit(key, kind) {
  if (!key) return denied('rate-limit-salt-missing')
  const name = resolveRateLimitProviderName()
  if (name === 'memory') {
    if (isProductionRuntime() && (process.env.LEADS_ALLOW_MEMORY_RATE_LIMIT || '').trim().toUpperCase() !== 'YES') {
      return denied('rate-limit-memory-forbidden-in-production')
    }
    return memoryConsumeRateLimit(key, kind)
  }
  if (name === 'supabase') {
    return supabaseConsume(key, kind)
  }
  return denied('rate-limit-provider-unknown')
}

export async function recordRateLimit(key, kind) {
  await consumeRateLimit(key, kind)
}
