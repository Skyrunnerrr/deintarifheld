import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getSupabasePublicConfig, assertSafeHostedSupabaseUrl } from './env.js';

export function createSupabaseMiddlewareClient(request) {
  const { url, anonKey } = getSupabasePublicConfig();
  if (!url || !anonKey) return { supabase: null, response: NextResponse.next() };

  const safe = assertSafeHostedSupabaseUrl(url);
  if (!safe.ok) {
    return { supabase: null, response: NextResponse.json({ ok: false, code: safe.code }, { status: 503 }) };
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: request.headers } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return { supabase, response };
}
