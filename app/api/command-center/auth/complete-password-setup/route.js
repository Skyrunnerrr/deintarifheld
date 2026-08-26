import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server.js';
import {
  clearHostedAuthFlowCookieOptions,
  hostedPasswordSetCookieOptions,
  requiresInitialPasswordSetup,
} from '../../../../../lib/command-center/invite-flow.js';
import { cookies } from 'next/headers';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const cookieStore = await cookies();
  if (!requiresInitialPasswordSetup(cookieStore, user.id)) {
    return NextResponse.json({ ok: true, code: 'ALREADY_COMPLETE' });
  }

  const response = NextResponse.json({ ok: true, code: 'PASSWORD_SETUP_COMPLETE' });
  response.cookies.set(hostedPasswordSetCookieOptions(user.id));
  response.cookies.set(clearHostedAuthFlowCookieOptions());
  return response;
}
