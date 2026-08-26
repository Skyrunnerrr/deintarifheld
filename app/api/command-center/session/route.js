import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server.js';
import { verifyHostedRequestSession, classifySessionForUx } from '../../../../lib/command-center/session-gate.js';
import { isHostedSupabaseConfigured } from '../../../../lib/supabase/env.js';

export async function GET() {
  if (!isHostedSupabaseConfigured()) {
    return NextResponse.json({ ok: false, state: 'UNAUTHENTICATED', code: 'HOSTED_AUTH_NOT_CONFIGURED' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const verified = await verifyHostedRequestSession(supabase);
  const ux = classifySessionForUx(verified);

  if (ux.state === 'AAL2') {
    return NextResponse.json({
      ok: true,
      state: 'AAL2',
      label: 'Hosted Operator · AAL2',
      authUserId: ux.authUserId,
    });
  }

  const status = ux.state === 'MFA_REQUIRED' ? 401 : 401;
  return NextResponse.json(
    { ok: false, state: ux.state, code: ux.code || verified.code },
    { status },
  );
}
