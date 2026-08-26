import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server.js';
import {
  HostedAuthFlowType,
  requiresInitialPasswordSetup,
} from '../../../../../lib/command-center/invite-flow.js';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ state: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const cookieStore = await cookies();
  if (requiresInitialPasswordSetup(cookieStore, user.id)) {
    const flowType = cookieStore.get('dth_hosted_auth_flow')?.value || HostedAuthFlowType.INVITE;
    return NextResponse.json({
      state: 'INITIAL_PASSWORD_REQUIRED',
      flowType,
    });
  }

  return NextResponse.json({ state: 'PASSWORD_SET' });
}
