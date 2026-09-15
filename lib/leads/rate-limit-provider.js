/**
 * Rate-limit provider abstraction.
 *
 * Providers:
 *   memory   — per-instance Map. Local / CI only.
 *   supabase — existing infra (table public.intake_rate_limits). Production default.
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
 *   Apply supabase/migrations/003_leads_rate_limits.sql (additive)
 */
import { createHash } from 'crypto'
import { getServiceSupabase } from './supabase.js'
import { isProductionRuntime } from './runtime-env.js'
import { leadsLog } from './log.js'

export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const RATE_LIMIT_MAX_SUBMITS = 5
export const RATE_LIMIT_MAX_ERRORS = 20
export const RATE_LIMIT_MAX_ADMIN = 5

const memoryBuckets = new Map()

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
  if (events.length < max) return { allowed: true, provider: 'memory' }
  const oldest = events[0] ?? now
  const retryAfter = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000))
  return { allowed: false, retryAfter, provider: 'memory' }
}

export function memoryRecordRateLimit(key, kind) {
  const now = Date.now()
  const bucket = memoryGet(key)
  pruneBucket(bucket, now)
  memoryEvents(bucket, kind).push(now)
}

export function resetRateLimitsForTests() {
  memoryBuckets.clear()
}

function denied(reason, retryAfter = 60) {
  return { allowed: false, retryAfter, reason, provider: 'fail-closed' }
}

export function resolveRateLimitProviderName() {
  const explicit = (process.env.LEADS_RATE_LIMIT_PROVIDER || '').trim().toLowerCase()
  if (explicit === 'memory' || explicit === 'supabase') return explicit
  return isProductionRuntime() ? 'supabase' : 'memory'
}

async function supabaseCheck(key, kind) {
  const supabase = getServiceSupabase()
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
  if (!data) return { allowed: true, provider: 'supabase' }
  const started = new Date(data.window_started_at).getTime()
  const now = Date.now()
  if (!Number.isFinite(started) || now - started >= RATE_LIMIT_WINDOW_MS) {
    return { allowed: true, provider: 'supabase' }
  }
  if ((data.hit_count || 0) >= maxForKind(kind)) {
    const retryAfter = Math.max(1, Math.ceil((started + RATE_LIMIT_WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfter, provider: 'supabase' }
  }
  return { allowed: true, provider: 'supabase' }
}

async function supabaseRecord(key, kind) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    if (!isProductionRuntime()) memoryRecordRateLimit(key, kind)
    return
  }
  const now = Date.now()
  const { data, error } = await supabase
    .from('intake_rate_limits')
    .select('window_started_at, hit_count')
    .eq('bucket_key', key)
    .eq('kind', kind)
    .maybeSingle()
  if (error) {
    leadsLog('error', 'rate_limit.supabase_record_failed', { code: 'rate-limit-backend-error' })
    if (!isProductionRuntime()) memoryRecordRateLimit(key, kind)
    return
  }
  const started = data ? new Date(data.window_started_at).getTime() : 0
  const fresh = !data || !Number.isFinite(started) || now - started >= RATE_LIMIT_WINDOW_MS
  const row = {
    bucket_key: key,
    kind,
    window_started_at: fresh ? new Date(now).toISOString() : data.window_started_at,
    hit_count: fresh ? 1 : (data.hit_count || 0) + 1,
    updated_at: new Date(now).toISOString(),
  }
  await supabase.from('intake_rate_limits').upsert(row, { onConflict: 'bucket_key,kind' })
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

export async function recordRateLimit(key, kind) {
  if (!key) return
  const name = resolveRateLimitProviderName()
  if (name === 'memory') {
    if (isProductionRuntime() && (process.env.LEADS_ALLOW_MEMORY_RATE_LIMIT || '').trim().toUpperCase() !== 'YES') {
      return
    }
    memoryRecordRateLimit(key, kind)
    return
  }
  if (name === 'supabase') {
    await supabaseRecord(key, kind)
  }
}
