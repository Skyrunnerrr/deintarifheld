import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabasePublicConfig, assertSafeHostedSupabaseUrl } from './env.js';

/**
 * App Router server Supabase client — cookie session transport (official @supabase/ssr).
 */
export async function createSupabaseServerClient(env = process.env) {
  const { url, anonKey } = getSupabasePublicConfig(env);
  if (!url || !anonKey) {
    throw new Error('SUPABASE_PUBLIC_CONFIG_MISSING');
  }
  const safe = assertSafeHostedSupabaseUrl(url, env);
  if (!safe.ok) {
    throw new Error(safe.code);
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll from Server Component — middleware handles refresh
        }
      },
    },
  });
}
