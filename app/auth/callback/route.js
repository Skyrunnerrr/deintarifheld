import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/command-center/';

  if (!code) {
    return NextResponse.redirect(new URL('/command-center/login/?error=callback', requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/command-center/login/?error=callback', requestUrl.origin));
  }

  const safeNext = next.startsWith('/command-center') ? next : '/command-center/';
  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
