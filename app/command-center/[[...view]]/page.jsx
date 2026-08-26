import { redirect } from 'next/navigation';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHostedShell } from '../../../packages/cc/src/ui/render.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';
import {
  HOSTED_CC_BASE,
  HOSTED_CC_NAV,
  resolveHostedCcView,
} from '../../../lib/command-center/hosted-routes.js';
import { verifyHostedRequestSession, classifySessionForUx } from '../../../lib/command-center/session-gate.js';
import { isHostedSupabaseConfigured } from '../../../lib/supabase/env.js';

export const dynamic = 'force-dynamic';

export default async function CommandCenterPage({ params }) {
  const segments = params.view || [];
  const activeView = resolveHostedCcView(segments);

  if (!activeView) {
    redirect(`${HOSTED_CC_BASE}/`);
  }

  if (!isHostedSupabaseConfigured()) {
    redirect(`${HOSTED_CC_BASE}/login/`);
  }

  const supabase = await createSupabaseServerClient();
  const verified = await verifyHostedRequestSession(supabase);
  const ux = classifySessionForUx(verified);

  if (ux.state === 'UNAUTHENTICATED' || ux.state === 'DENIED') {
    redirect(`${HOSTED_CC_BASE}/login/`);
  }
  if (ux.state === 'MFA_REQUIRED') {
    redirect(`${HOSTED_CC_BASE}/mfa/`);
  }

  const html = renderHostedShell({
    activeView,
    sessionLabel: 'Hosted Operator · AAL2',
    connectionState: 'pending',
    connectionText: 'Ops-API: Prüfung…',
    opsBaseUrl: '/api/command-center/ops',
    navItems: HOSTED_CC_NAV,
    clientScriptPath: '/command-center/assets/cc-hosted-client.js',
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
