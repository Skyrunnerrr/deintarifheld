'use client';

import { createBrowserClient } from '@supabase/ssr';

let browserClient = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error('SUPABASE_PUBLIC_CONFIG_MISSING');
  }
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
