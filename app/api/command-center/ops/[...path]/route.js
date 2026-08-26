import { NextResponse } from 'next/server';
import { createOpsBff } from '../../../../../packages/ops-api/src/bff/create-ops-bff.js';
import { INTERNAL_BFF_PREFIX } from '../../../../../packages/ops-api/src/bff/constants.js';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server.js';
import { createHostedAuthAdapters } from '../../../../../lib/supabase/hosted-auth-adapters.js';
import { verifyHostedRequestSession } from '../../../../../lib/command-center/session-gate.js';
import { createHostedOpsPool } from '../../../../../lib/command-center/ops-pool.js';
import { getHostedAuthModeEnv, isHostedSupabaseConfigured } from '../../../../../lib/supabase/env.js';

export const dynamic = 'force-dynamic';

function buildOpsPath(segments) {
  return `${INTERNAL_BFF_PREFIX}/${(segments || []).join('/')}`;
}

async function handleOpsRequest(request, { params }) {
  if (!isHostedSupabaseConfigured()) {
    return NextResponse.json({ ok: false, code: 'HOSTED_AUTH_NOT_CONFIGURED' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const pool = createHostedOpsPool();
  const hostedEnv = getHostedAuthModeEnv();

  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const headers = Object.fromEntries(request.headers.entries());

  const hostedAuth = createHostedAuthAdapters(supabase);

  if (!pool) {
    const verified = await verifyHostedRequestSession(supabase);
    if (!verified.ok) {
      return NextResponse.json({ ok: false, code: verified.code }, { status: verified.status || 401 });
    }
    return NextResponse.json(
      { ok: false, code: 'STAGING_OPS_DATABASE_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const bff = createOpsBff({
    pool,
    env: hostedEnv,
    hostedAuth,
  });

  const path = buildOpsPath(params.path);
  const method = request.method.toUpperCase();
  let body = {};
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const accessToken = await hostedAuth.getAccessToken();

  const result = await bff.dispatch({
    method,
    path,
    headers,
    query,
    body,
    accessToken,
  });

  return NextResponse.json(result.body ?? { ok: false }, { status: result.status || 500 });
}

export async function GET(request, ctx) {
  return handleOpsRequest(request, ctx);
}

export async function POST(request, ctx) {
  return handleOpsRequest(request, ctx);
}
