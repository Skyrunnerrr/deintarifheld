import { NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from './lib/supabase/middleware.js';
import { HOSTED_CC_BASE, isHostedCcPublicPath } from './lib/command-center/hosted-routes.js';
import { isHostedSupabaseConfigured } from './lib/supabase/env.js';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/auth/callback')) {
    if (!isHostedSupabaseConfigured()) {
      return NextResponse.json({ ok: false, code: 'HOSTED_AUTH_NOT_CONFIGURED' }, { status: 503 });
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith(HOSTED_CC_BASE)) {
    return NextResponse.next();
  }

  if (isHostedCcPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith(`${HOSTED_CC_BASE}/assets/`)) {
    return NextResponse.next();
  }

  if (!isHostedSupabaseConfigured()) {
    return NextResponse.redirect(new URL(`${HOSTED_CC_BASE}/login/`, request.url));
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request);
  if (!supabase) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(`${HOSTED_CC_BASE}/login/`, request.url);
    const returnTo = pathname.replace(/\/$/, '') || HOSTED_CC_BASE;
    if (returnTo.startsWith(HOSTED_CC_BASE)) {
      loginUrl.searchParams.set('returnTo', returnTo);
    }
    return NextResponse.redirect(loginUrl);
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aalData?.currentLevel;
  const nextLevel = aalData?.nextLevel;
  const aal2 = currentLevel === 'aal2' && !nextLevel;

  if (!aal2) {
    return NextResponse.redirect(new URL(`${HOSTED_CC_BASE}/mfa/`, request.url));
  }

  return response;
}

export const config = {
  matcher: ['/command-center/:path*', '/auth/callback'],
};
