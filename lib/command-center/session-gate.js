import {
  verifyHostedSupabaseSession,
  gateHostedA11Request,
  assertSafeAuthRedirect,
} from '../../packages/ops-api/src/auth/hosted-session.js';
import { OperatorAssuranceLevel } from '@deintarifheld/shared';
import { createHostedAuthAdapters } from '../supabase/hosted-auth-adapters.js';
import { getHostedAuthModeEnv } from '../supabase/env.js';

export async function verifyHostedRequestSession(supabase, env = process.env) {
  const hostedAuth = createHostedAuthAdapters(supabase);
  const accessToken = await hostedAuth.getAccessToken();
  const hostedEnv = getHostedAuthModeEnv(env);
  return verifyHostedSupabaseSession({
    accessToken,
    getUser: hostedAuth.getUser,
    getAuthenticatorAssuranceLevel: hostedAuth.getAuthenticatorAssuranceLevel,
    env: hostedEnv,
  });
}

export async function gateHostedOpsRequest({ supabase, pool, headers, body, query, env = process.env }) {
  const hostedAuth = createHostedAuthAdapters(supabase);
  const accessToken = await hostedAuth.getAccessToken();
  const hostedEnv = getHostedAuthModeEnv(env);
  return gateHostedA11Request({
    pool,
    headers: headers || {},
    accessToken,
    getUser: hostedAuth.getUser,
    getAuthenticatorAssuranceLevel: hostedAuth.getAuthenticatorAssuranceLevel,
    env: hostedEnv,
    body: body || {},
    query: query || {},
  });
}

export function classifySessionForUx(verified, { initialPasswordRequired = false } = {}) {
  if (initialPasswordRequired) {
    return { state: 'INITIAL_PASSWORD_REQUIRED' };
  }
  if (!verified?.ok) {
    if (verified?.code === 'AAL2_REQUIRED') {
      return { state: 'MFA_REQUIRED', aal: verified.aal || OperatorAssuranceLevel.AAL1 };
    }
    if (verified?.code === 'AUTH_SESSION_MISSING' || verified?.code === 'AUTH_SESSION_EXPIRED') {
      return { state: 'UNAUTHENTICATED' };
    }
    return { state: 'DENIED', code: verified.code };
  }
  return { state: 'AAL2', authUserId: verified.authUserId };
}

export { assertSafeAuthRedirect };
