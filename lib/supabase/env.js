/**
 * Supabase public config — browser-safe credentials only.
 * Fail closed if production project ref appears in hosted staging mode.
 */
const STAGING_SUPABASE_REF = 'uunpbmfvbfkideylhtbl';
const PRODUCTION_SUPABASE_REF = 'ylvczlldcgaxyadlawtb';

export function getSupabasePublicConfig(env = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || env.STAGING_SUPABASE_URL || '').trim();
  const anonKey = String(
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.STAGING_SUPABASE_ANON_KEY || '',
  ).trim();
  return { url, anonKey };
}

export function assertSafeHostedSupabaseUrl(url, env = process.env) {
  if (!url) return { ok: false, code: 'SUPABASE_URL_MISSING' };
  if (url.includes(PRODUCTION_SUPABASE_REF)) {
    return { ok: false, code: 'PRODUCTION_SUPABASE_REF_FORBIDDEN' };
  }
  const mode = String(env.DTH_AUTH_MODE || env.DTH_OPERATOR_AUTH_MODE || '').toLowerCase();
  const hosted =
    mode === 'hosted' ||
    mode === 'staging' ||
    mode === 'production' ||
    String(env.VERCEL_ENV || '').toLowerCase() === 'preview' ||
    String(env.VERCEL_ENV || '').toLowerCase() === 'production';
  if (hosted && !url.includes(STAGING_SUPABASE_REF)) {
    return { ok: false, code: 'STAGING_SUPABASE_REF_REQUIRED' };
  }
  return { ok: true, stagingRef: STAGING_SUPABASE_REF };
}

export function isHostedSupabaseConfigured(env = process.env) {
  const { url, anonKey } = getSupabasePublicConfig(env);
  if (!url || !anonKey) return false;
  return assertSafeHostedSupabaseUrl(url, env).ok;
}

export function getHostedAuthModeEnv(env = process.env) {
  return {
    ...env,
    DTH_AUTH_MODE: 'hosted',
    DTH_LOCAL_AUTH_ENABLED: 'false',
  };
}
