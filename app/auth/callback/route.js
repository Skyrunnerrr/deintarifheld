import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';
import {
  classifyAuthCallbackFlow,
  hostedAuthFlowCookieOptions,
  resolvePostCallbackRedirect,
} from '../../../lib/command-center/invite-flow.js';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const typeParam = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/command-center/';

  if (!code) {
    return NextResponse.redirect(new URL('/command-center/login/?error=callback', requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/command-center/login/?error=callback', requestUrl.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const flowType = classifyAuthCallbackFlow({ typeParam, user });
  const redirectPath = resolvePostCallbackRedirect({
    flowType,
    next,
    userId: user?.id,
    cookies: request.cookies,
  });

  const response = NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
  if (flowType && redirectPath.startsWith('/command-center/set-password')) {
    response.cookies.set(hostedAuthFlowCookieOptions(flowType));
  }
  return response;
}
