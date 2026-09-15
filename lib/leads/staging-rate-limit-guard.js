/**
 * Staging-only rate-limit concurrency probe guard.
 * Never writes unless ALLOW_STAGING_RATE_LIMIT_TEST=YES, both
 * EXPECTED_STAGING_SUPABASE_PROJECT_REF and PRODUCTION_SUPABASE_PROJECT_REF
 * are set and different, and the live URL ref equals the expected staging ref.
 */

export function parseSupabaseProjectRef(url) {
  if (typeof url !== 'string' || !url.trim()) return ''
  try {
    const host = new URL(url).hostname.toLowerCase()
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

/**
 * @returns {{ ok: boolean, status: string, reason: string, actualRef?: string }}
 */
export function evaluateStagingRateLimitTarget({
  allowTest = false,
  expectedRef = '',
  supabaseUrl = '',
  productionRuntime = false,
  productionProjectRef = '',
} = {}) {
  if (!allowTest) {
    return { ok: true, status: 'UNKNOWN', reason: 'staging_test_not_authorized' }
  }
  if (productionRuntime) {
    return { ok: false, status: 'FAIL', reason: 'production_runtime' }
  }
  const expected = String(expectedRef || '').trim().toLowerCase()
  if (!expected) {
    return { ok: false, status: 'FAIL', reason: 'missing_expected_ref' }
  }
  const productionRef = String(productionProjectRef || '').trim().toLowerCase()
  if (!productionRef) {
    return { ok: false, status: 'FAIL', reason: 'missing_production_ref' }
  }
  if (expected === productionRef) {
    return { ok: false, status: 'FAIL', reason: 'staging_production_refs_identical' }
  }
  const actual = parseSupabaseProjectRef(supabaseUrl)
  if (!actual) {
    return { ok: false, status: 'FAIL', reason: 'unparseable_supabase_url' }
  }
  if (actual === productionRef) {
    return { ok: false, status: 'FAIL', reason: 'production_project', actualRef: actual }
  }
  if (actual !== expected) {
    return { ok: false, status: 'FAIL', reason: 'project_ref_mismatch', actualRef: actual }
  }
  return { ok: true, status: 'AUTHORIZED', reason: 'staging_ref_matched', actualRef: actual }
}
