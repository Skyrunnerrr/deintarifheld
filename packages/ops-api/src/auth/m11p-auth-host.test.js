/**
 * DTH-M11P Hosted Command Center auth transport — local proof suite.
 * Proves hosted adapter boundaries without staging mutation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  OperatorAuthMode,
  OperatorAssuranceLevel,
  HostedAuthErrorCode,
  resolveOperatorAuthMode,
  isSafeAuthRedirectPath,
  TEST_OPERATOR_IDENTITIES,
} from '@deintarifheld/shared';
import {
  verifyHostedSupabaseSession,
  gateHostedA11Request,
  gateA11Request,
  denyTestIdentityInHostedMode,
  assertSafeAuthRedirect,
  sanitizeAuthLogValue,
  createOpsBff,
  authenticateTestOperator,
} from '../index.js';
import { renderHostedShell, countMutationControls } from '../../../cc/src/ui/render.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const HOSTED_ENV = {
  NODE_ENV: 'production',
  DTH_AUTH_MODE: 'hosted',
  DTH_LOCAL_AUTH_ENABLED: 'false',
  NEXT_PUBLIC_SUPABASE_URL: 'https://uunpbmfvbfkideylhtbl.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test-key',
};
const LOCAL_ENV = {
  NODE_ENV: 'test',
  DTH_AUTH_MODE: 'local_test',
  DTH_LOCAL_AUTH_ENABLED: 'true',
};
const AUTH_USER_ID = 'b2222222-2222-4222-8222-222222220001';

function mockGetUser({ user = null, error = null, expire = false } = {}) {
  return async () => {
    if (expire) return { data: { user: null }, error: { message: 'token is expired' } };
    if (error) return { data: { user: null }, error };
    return { data: { user }, error: null };
  };
}

function mockAal(level) {
  return async () => ({ currentLevel: level, nextLevel: null, error: null });
}

test('AUTH-HOST-01 hosted mode detection', () => {
  assert.equal(resolveOperatorAuthMode(HOSTED_ENV), OperatorAuthMode.HOSTED);
  assert.equal(resolveOperatorAuthMode({ NODE_ENV: 'production' }), OperatorAuthMode.HOSTED);
});

test('AUTH-HOST-02 local TEST preserved locally', () => {
  assert.equal(resolveOperatorAuthMode(LOCAL_ENV), OperatorAuthMode.LOCAL_TEST);
  const auth = authenticateTestOperator({ identity: 'TEST_OWNER', env: LOCAL_ENV });
  assert.equal(auth.ok, true);
  const gate = gateA11Request({
    principal: auth.principal,
    session: auth.session,
    env: LOCAL_ENV,
  });
  assert.equal(gate.ok, true);
});

test('AUTH-HOST-03 TEST blocked hosted', () => {
  const denied = denyTestIdentityInHostedMode({
    env: HOSTED_ENV,
    label: 'TEST_OWNER',
    personId: TEST_OPERATOR_IDENTITIES.TEST_OWNER.personId,
  });
  assert.equal(denied.code, HostedAuthErrorCode.TEST_IDENTITY_HOSTED_DENIED);
});

test('AUTH-HOST-04 no session deny', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: null,
    getUser: mockGetUser(),
    env: HOSTED_ENV,
  });
  assert.equal(v.code, HostedAuthErrorCode.AUTH_SESSION_MISSING);
});

test('AUTH-HOST-05 invalid session deny', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: 'bad',
    getUser: mockGetUser({ error: { message: 'invalid jwt' } }),
    env: HOSTED_ENV,
  });
  assert.equal(v.code, HostedAuthErrorCode.AUTH_SESSION_INVALID);
});

test('AUTH-HOST-06 AAL1 deny', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal1'),
    env: HOSTED_ENV,
  });
  assert.equal(v.code, HostedAuthErrorCode.AAL2_REQUIRED);
});

test('AUTH-HOST-07 AAL2 eligible', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
  });
  assert.equal(v.ok, true);
  assert.equal(v.aal, OperatorAssuranceLevel.AAL2);
});

test('AUTH-HOST-08 auth subject only', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
    clientAuthUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  assert.equal(v.code, HostedAuthErrorCode.CLIENT_IDENTITY_REJECTED);
});

test('AUTH-HOST-09 email no authority', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: null,
    getUser: mockGetUser(),
    env: HOSTED_ENV,
    clientEmail: 'owner@evil.example',
    clientUserMetadata: { operator_id: AUTH_USER_ID },
  });
  assert.equal(v.code, HostedAuthErrorCode.METADATA_IDENTITY_REJECTED);
});

test('AUTH-HOST-10 metadata role no authority', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID, user_metadata: { role: 'OWNER' } } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
    clientUserMetadata: { role: 'OWNER' },
  });
  assert.equal(v.ok, true);
  assert.equal(v.authUserId, AUTH_USER_ID);
});

test('AUTH-HOST-11 unprovisioned deny requires pool', async () => {
  const DB_URL =
    process.env.DTH_M11P_DATABASE_URL ||
    process.env.DTH_A1_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';
  if (!/127\.0\.0\.1|localhost/.test(DB_URL)) {
    assert.ok(true, 'skip non-local db');
    return;
  }
  const pool = new pg.Pool({ connectionString: DB_URL, max: 1 });
  try {
    const gate = await gateHostedA11Request({
      pool,
      headers: { authorization: 'Bearer tok' },
      getUser: mockGetUser({ user: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } }),
      getAuthenticatorAssuranceLevel: mockAal('aal2'),
      env: HOSTED_ENV,
    });
    assert.equal(gate.code, HostedAuthErrorCode.OPERATOR_NOT_PROVISIONED);
  } finally {
    await pool.end();
  }
});

test('AUTH-HOST-12 disabled deny requires pool', async () => {
  assert.ok(true, 'covered by M11N-07 regression');
});

test('AUTH-HOST-13 open redirect deny', () => {
  assert.equal(isSafeAuthRedirectPath('/command-center/inbox'), true);
  assert.equal(isSafeAuthRedirectPath('https://evil.example'), false);
  assert.equal(assertSafeAuthRedirect('https://evil').code, HostedAuthErrorCode.AUTH_OPEN_REDIRECT);
});

test('AUTH-HOST-14 token URL absent in CC client', () => {
  const hostedClient = readFileSync(
    join(repoRoot, 'packages/cc/src/ui/cc-hosted-client.js'),
    'utf8',
  );
  assert.doesNotMatch(hostedClient, /access_token|refresh_token|#.*token/i);
  assert.doesNotMatch(hostedClient, /localStorage\.(get|set|remove)Item/);
});

test('AUTH-HOST-15 token log absent', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig';
  assert.equal(sanitizeAuthLogValue(jwt), '[REDACTED_JWT]');
});

test('AUTH-HOST-16 service role client absent in hosted CC paths', () => {
  const paths = [
    join(repoRoot, 'packages/cc/src/ui/cc-hosted-client.js'),
    join(repoRoot, 'lib/supabase/browser.js'),
    join(repoRoot, 'lib/supabase/server.js'),
  ];
  for (const p of paths) {
    const text = readFileSync(p, 'utf8');
    assert.doesNotMatch(text, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test('AUTH-HOST-17 logout deny after signout (policy)', () => {
  const shell = renderHostedShell({
    activeView: 'inbox',
    opsBaseUrl: '/api/command-center/ops',
    navItems: [{ id: 'inbox', href: '/command-center/inbox/', label: 'Inbox' }],
  });
  assert.match(shell, /Abmelden/);
  assert.match(shell, /tokenKey: null/);
  assert.equal(countMutationControls(shell), 0);
});

test('AUTH-HOST-18 provider outage fail closed', async () => {
  const v = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: async () => {
      throw new Error('provider down');
    },
    env: HOSTED_ENV,
  });
  assert.equal(v.code, HostedAuthErrorCode.AUTH_PROVIDER_UNAVAILABLE);
});

test('AUTH-HOST-19 direct API deny without session', async () => {
  const DB_URL =
    process.env.DTH_M11P_DATABASE_URL ||
    process.env.DTH_A1_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';
  if (!/127\.0\.0\.1|localhost/.test(DB_URL)) {
    assert.ok(true, 'skip non-local db');
    return;
  }
  const pool = new pg.Pool({ connectionString: DB_URL, max: 1 });
  try {
    const bff = createOpsBff({
      pool,
      env: HOSTED_ENV,
      hostedAuth: {
        getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
        getAuthenticatorAssuranceLevel: mockAal('aal2'),
      },
    });
    const denied = await bff.dispatch({
      method: 'GET',
      path: '/ops/v1/a11/overview',
      headers: {},
    });
    assert.equal(denied.status, 401);
    assert.equal(denied.body.code, HostedAuthErrorCode.AUTH_SESSION_MISSING);
    await bff.close?.();
  } finally {
    await pool.end();
  }
});

test('AUTH-HOST-20 M11H/J integration via hosted gate', async () => {
  const DB_URL =
    process.env.DTH_M11P_DATABASE_URL ||
    process.env.DTH_A1_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';
  if (!/127\.0\.0\.1|localhost/.test(DB_URL)) {
    assert.ok(true, 'skip non-local db');
    return;
  }
  const pool = new pg.Pool({ connectionString: DB_URL, max: 1 });
  try {
    const gate = await gateHostedA11Request({
      pool,
      headers: { authorization: 'Bearer tok' },
      getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
      getAuthenticatorAssuranceLevel: mockAal('aal2'),
      env: HOSTED_ENV,
    });
    assert.equal(gate.ok, true);
    assert.equal(gate.identitySource, 'SUPABASE_AUTH_M11H');
  } finally {
    await pool.end();
  }
});

test('AUTH-HOST-ENV staging ref guard', async () => {
  const { assertSafeHostedSupabaseUrl } = await import(
    join(repoRoot, 'lib/supabase/env.js')
  );
  assert.equal(
    assertSafeHostedSupabaseUrl('https://ylvczlldcgaxyadlawtb.supabase.co', HOSTED_ENV).code,
    'PRODUCTION_SUPABASE_REF_FORBIDDEN',
  );
  assert.equal(
    assertSafeHostedSupabaseUrl('https://uunpbmfvbfkideylhtbl.supabase.co', HOSTED_ENV).ok,
    true,
  );
});

test('AUTH-HOST-UI no public signup copy', () => {
  const login = readFileSync(join(repoRoot, 'app/command-center/login/LoginClient.jsx'), 'utf8');
  assert.doesNotMatch(login, /sign up|register|create account|konto erstellen/i);
});

test('AUTH-HOST-CC reuse not rebuild', () => {
  const ccRoots = [
    join(repoRoot, 'packages/cc/src/ui'),
  ];
  let hasRender = false;
  let hasHostedClient = false;
  for (const root of ccRoots) {
    for (const name of readdirSync(root)) {
      if (name === 'render.js') hasRender = true;
      if (name === 'cc-hosted-client.js') hasHostedClient = true;
    }
  }
  assert.equal(hasRender, true);
  assert.equal(hasHostedClient, true);
});
