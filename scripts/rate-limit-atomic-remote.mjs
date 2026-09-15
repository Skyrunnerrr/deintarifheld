#!/usr/bin/env node
/**
 * Staging-only parallel consume_rate_limit proof.
 * Not for production. Not run by default CI against a live DB.
 *
 * Expected: 20 parallel consume, p_max_hits=5 → exactly 5 allowed, 15 denied,
 * hit_count contiguous, no lost updates.
 *
 * Without ALLOW_STAGING_RATE_LIMIT_TEST=YES this script only documents
 * RATE_LIMIT_ATOMIC_REMOTE_DB=UNKNOWN and exits 0.
 */
import { getServiceSupabase } from '../lib/leads/supabase.js'
import { isProductionRuntime } from '../lib/leads/runtime-env.js'

const PARALLEL = 20
const MAX_HITS = 5
const allow = (process.env.ALLOW_STAGING_RATE_LIMIT_TEST || '').trim().toUpperCase() === 'YES'

if (isProductionRuntime()) {
  console.error('RATE_LIMIT_ATOMIC_REMOTE_DB=BLOCKED_PRODUCTION')
  console.error('PRODUCTION_DATA_MUTATED=NO')
  process.exit(1)
}

if (!allow) {
  console.log('RATE_LIMIT_ATOMIC_REMOTE_DB=UNKNOWN')
  console.log('RATE_LIMIT_ATOMIC_REMOTE_REASON=staging_test_not_authorized')
  console.log('PRODUCTION_DATA_MUTATED=NO')
  process.exit(0)
}

const supabase = getServiceSupabase()
if (!supabase) {
  console.error('RATE_LIMIT_ATOMIC_REMOTE_DB=FAIL')
  console.error('staging supabase missing')
  process.exit(1)
}

const bucket = `staging-atomic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const results = await Promise.all(
  Array.from({ length: PARALLEL }, () =>
    supabase.rpc('consume_rate_limit', {
      p_bucket_key: bucket,
      p_kind: 'submit',
      p_window_seconds: 600,
      p_max_hits: MAX_HITS,
    }),
  ),
)

const rows = results.map((r) => {
  if (r.error) throw new Error(r.error.message || 'rpc error')
  const row = Array.isArray(r.data) ? r.data[0] : r.data
  return row
})
const allowed = rows.filter((r) => r.allowed === true)
const denied = rows.filter((r) => r.allowed !== true)
const hits = rows.map((r) => Number(r.hit_count)).sort((a, b) => a - b)

let ok = allowed.length === MAX_HITS && denied.length === PARALLEL - MAX_HITS
if (hits[0] !== 1 || hits[hits.length - 1] !== PARALLEL) ok = false
for (let i = 0; i < hits.length; i += 1) {
  if (hits[i] !== i + 1) ok = false
}

console.log(`RATE_LIMIT_ATOMIC_REMOTE_ALLOWED=${allowed.length}`)
console.log(`RATE_LIMIT_ATOMIC_REMOTE_DENIED=${denied.length}`)
console.log(`RATE_LIMIT_ATOMIC_REMOTE_HIT_MAX=${hits[hits.length - 1]}`)
console.log(`RATE_LIMIT_ATOMIC_REMOTE_DB=${ok ? 'PASS' : 'FAIL'}`)
console.log('PRODUCTION_DATA_MUTATED=NO')
process.exit(ok ? 0 : 1)
