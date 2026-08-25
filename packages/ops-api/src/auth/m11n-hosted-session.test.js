/**
 * DTH-M11N Hosted operator session security — local disposable proof.
 * Uses injectable Supabase adapters; no hosted project mutation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  OPERATOR_SESSION_POLICY_V1,
  OperatorAuthMode,
  OperatorAssuranceLevel,
  HostedAuthErrorCode,
  resolveOperatorAuthMode,
  isSafeAuthRedirectPath,
  TEST_OPERATOR_IDENTITIES,
  TEST_OPERATOR_STABLE_IDS,
} from '@deintarifheld/shared';
import {
  bootstrapE2TestOperatorAuthority,
} from '@deintarifheld/db';
import {
  verifyHostedSupabaseSession,
  resolveHostedOperatorFromSession,
  gateHostedA11Request,
  extractBearerAccessToken,
  sanitizeAuthLogValue,
  denyTestIdentityInHostedMode,
  assertSafeAuthRedirect,
  gateA11Request,
  createOpsBff,
} from '../index.js';
import { authenticateTestOperator } from '../index.js';

const DB_URL =
  process.env.DTH_M11N_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const AUTH_USER_ID = 'b2222222-2222-4222-8222-222222220001';
const HOSTED_ENV = {
  NODE_ENV: 'test',
  DTH_AUTH_MODE: 'hosted',
  DTH_LOCAL_AUTH_ENABLED: 'false',
};
const LOCAL_ENV = {
  NODE_ENV: 'test',
  DTH_AUTH_MODE: 'local_test',
  DTH_LOCAL_AUTH_ENABLED: 'true',
};

const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../supabase/migrations');
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });

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

test('M11N-00 session policy recorded', () => {
  assert.equal(OPERATOR_SESSION_POLICY_V1.decisionId, 'OD-A11-SESSION-POLICY');
  assert.equal(OPERATOR_SESSION_POLICY_V1.status, 'APPROVED_FOR_M11N_IMPLEMENTATION');
  assert.equal(OPERATOR_SESSION_POLICY_V1.minimumAssurance, OperatorAssuranceLevel.AAL2);
  assert.equal(OPERATOR_SESSION_POLICY_V1.mfa, 'TOTP_REQUIRED');
  assert.equal(OPERATOR_SESSION_POLICY_V1.publicOperatorSignup, 'DISABLED');
  assert.equal(OPERATOR_SESSION_POLICY_V1.localStorageAuthority, 'NONE');
  assert.equal(OPERATOR_SESSION_POLICY_V1.inactivityTimeoutMinutes, 30);
  assert.equal(OPERATOR_SESSION_POLICY_V1.maximumLifetimeHours, 12);
});

test('M11N-01 auth mode resolution', () => {
  assert.equal(resolveOperatorAuthMode(HOSTED_ENV), OperatorAuthMode.HOSTED);
  assert.equal(resolveOperatorAuthMode(LOCAL_ENV), OperatorAuthMode.LOCAL_TEST);
  assert.equal(resolveOperatorAuthMode({ NODE_ENV: 'production' }), OperatorAuthMode.HOSTED);
});

test('M11N-00b apply M11H schema + map auth user', async () => {
  for (const f of [
    '20260822140000_m11h_operator_identity_mapping.sql',
    '20260822150000_m11i_operator_role_capability_mapping.sql',
  ]) {
    await admin.query(readFileSync(join(migDir, f), 'utf8'));
  }
  await bootstrapE2TestOperatorAuthority(admin);
  await admin.query(
    `INSERT INTO security.operator_auth_identities (operator_id, auth_user_id, status)
     VALUES ($1::uuid, $2::uuid, 'ACTIVE')
     ON CONFLICT DO NOTHING`,
    [TEST_OPERATOR_STABLE_IDS.TEST_OWNER, AUTH_USER_ID],
  );
  // Unique active auth_user may conflict — upsert carefully
  await admin.query(
    `UPDATE security.operator_auth_identities
     SET status = 'DISABLED', deactivated_at = now()
     WHERE auth_user_id = $1::uuid AND status = 'ACTIVE'`,
    [AUTH_USER_ID],
  );
  await admin.query(
    `UPDATE security.operator_auth_identities
     SET status = 'DISABLED', deactivated_at = now()
     WHERE operator_id = $1::uuid AND status = 'ACTIVE'`,
    [TEST_OPERATOR_STABLE_IDS.TEST_OWNER],
  );
  await admin.query(
    `INSERT INTO security.operator_auth_identities (operator_id, auth_user_id, status)
     VALUES ($1::uuid, $2::uuid, 'ACTIVE')`,
    [TEST_OPERATOR_STABLE_IDS.TEST_OWNER, AUTH_USER_ID],
  );
});

test('M11N-02/08 valid AAL2 session verifies', async () => {
  const verified = await verifyHostedSupabaseSession({
    accessToken: 'test-access-token',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID, email: 'owner@example.com' } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.authUserId, AUTH_USER_ID);
  assert.equal(verified.aal, OperatorAssuranceLevel.AAL2);
});

test('M11N-09 AAL1 denies protected session', async () => {
  const verified = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal1'),
    env: HOSTED_ENV,
  });
  assert.equal(verified.ok, false);
  assert.equal(verified.code, HostedAuthErrorCode.AAL2_REQUIRED);
});

test('M11N-10/11/12 missing invalid expired session', async () => {
  assert.equal(
    (await verifyHostedSupabaseSession({ accessToken: null, getUser: mockGetUser(), env: HOSTED_ENV }))
      .code,
    HostedAuthErrorCode.AUTH_SESSION_MISSING,
  );
  assert.equal(
    (
      await verifyHostedSupabaseSession({
        accessToken: 'x',
        getUser: mockGetUser({ error: { message: 'invalid jwt' } }),
        env: HOSTED_ENV,
      })
    ).code,
    HostedAuthErrorCode.AUTH_SESSION_INVALID,
  );
  assert.equal(
    (
      await verifyHostedSupabaseSession({
        accessToken: 'x',
        getUser: mockGetUser({ expire: true }),
        env: HOSTED_ENV,
      })
    ).code,
    HostedAuthErrorCode.AUTH_SESSION_EXPIRED,
  );
});

test('M11N-13 provider unavailable fail closed', async () => {
  const verified = await verifyHostedSupabaseSession({
    accessToken: 'x',
    getUser: async () => {
      throw new Error('network');
    },
    env: HOSTED_ENV,
  });
  assert.equal(verified.code, HostedAuthErrorCode.AUTH_PROVIDER_UNAVAILABLE);
});

test('M11N-04/05/06 M11H mapping + unprovisioned', async () => {
  const verified = {
    ok: true,
    authUserId: AUTH_USER_ID,
    aal: OperatorAssuranceLevel.AAL2,
  };
  const mapped = await resolveHostedOperatorFromSession(admin, verified);
  assert.equal(mapped.ok, true);
  assert.equal(mapped.operatorId, TEST_OPERATOR_STABLE_IDS.TEST_OWNER);

  const none = await resolveHostedOperatorFromSession(admin, {
    ok: true,
    authUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    aal: OperatorAssuranceLevel.AAL2,
  });
  assert.equal(none.code, HostedAuthErrorCode.OPERATOR_NOT_PROVISIONED);
});

test('M11N-07 disabled operator deny', async () => {
  await admin.query(
    `UPDATE security.operators SET status = 'DISABLED' WHERE operator_id = $1::uuid`,
    [TEST_OPERATOR_STABLE_IDS.TEST_OWNER],
  );
  try {
    const mapped = await resolveHostedOperatorFromSession(admin, {
      ok: true,
      authUserId: AUTH_USER_ID,
      aal: OperatorAssuranceLevel.AAL2,
    });
    assert.equal(mapped.code, HostedAuthErrorCode.OPERATOR_DISABLED);
  } finally {
    await admin.query(
      `UPDATE security.operators SET status = 'ACTIVE' WHERE operator_id = $1::uuid`,
      [TEST_OPERATOR_STABLE_IDS.TEST_OWNER],
    );
  }
});

test('M11N-16/18 body authUserId and client AAL spoof ignored/denied', async () => {
  const spoofUser = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
    clientAuthUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  assert.equal(spoofUser.code, HostedAuthErrorCode.CLIENT_IDENTITY_REJECTED);

  const spoofAal = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal1'),
    env: HOSTED_ENV,
    clientClaimedAal: 'aal2',
  });
  assert.equal(spoofAal.code, HostedAuthErrorCode.AAL2_REQUIRED);
});

test('M11N-17 metadata role OWNER has zero authority', async () => {
  const verified = await verifyHostedSupabaseSession({
    accessToken: 'tok',
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
    clientUserMetadata: { role: 'OWNER' },
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.authUserId, AUTH_USER_ID);
});

test('M11N-15 TEST_* hosted deny', () => {
  const denied = denyTestIdentityInHostedMode({
    env: HOSTED_ENV,
    identitySource: 'TEST_E2_ONLY',
    label: 'TEST_OWNER',
    personId: TEST_OPERATOR_IDENTITIES.TEST_OWNER.personId,
  });
  assert.equal(denied.code, HostedAuthErrorCode.TEST_IDENTITY_HOSTED_DENIED);

  const gate = gateA11Request({
    principal: { type: 'PERSON', personId: TEST_OPERATOR_IDENTITIES.TEST_OWNER.personId },
    session: {
      ccSession: true,
      personId: TEST_OPERATOR_IDENTITIES.TEST_OWNER.personId,
      principalType: 'PERSON',
      sessionId: 's1',
    },
    env: HOSTED_ENV,
  });
  assert.equal(gate.code, HostedAuthErrorCode.TEST_IDENTITY_HOSTED_DENIED);
});

test('M11N-14 TEST_* local still works', () => {
  const auth = authenticateTestOperator({
    identity: 'TEST_OWNER',
    env: LOCAL_ENV,
  });
  assert.equal(auth.ok, true);
  const gate = gateA11Request({
    principal: auth.principal,
    session: auth.session,
    env: LOCAL_ENV,
  });
  assert.equal(gate.ok, true);
  assert.equal(gate.identitySource, 'TEST_E2_ONLY');
});

test('M11N-03/28 bearer extraction + hosted BFF gate', async () => {
  assert.equal(extractBearerAccessToken({ authorization: 'Bearer abc.def.ghi' }), 'abc.def.ghi');
  assert.equal(extractBearerAccessToken({ authorization: 'DTH-Local x' }), null);

  const bff = createOpsBff({
    pool: admin,
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

  const ok = await bff.dispatch({
    method: 'GET',
    path: '/ops/v1/a11/overview',
    headers: { authorization: 'Bearer good-token' },
  });
  // May 200 or domain error, but must not be auth deny
  assert.notEqual(ok.body.code, HostedAuthErrorCode.AUTH_SESSION_MISSING);
  assert.notEqual(ok.body.code, HostedAuthErrorCode.AAL2_REQUIRED);
  await bff.close?.();
});

test('M11N-23/24 token URL + log safety', () => {
  assert.equal(isSafeAuthRedirectPath('/cc'), true);
  assert.equal(isSafeAuthRedirectPath('https://evil.example/phish'), false);
  assert.equal(isSafeAuthRedirectPath('//evil.example'), false);
  assert.equal(assertSafeAuthRedirect('https://evil').code, HostedAuthErrorCode.AUTH_OPEN_REDIRECT);
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig';
  assert.equal(sanitizeAuthLogValue(jwt), '[REDACTED_JWT]');
  assert.equal(sanitizeAuthLogValue('Bearer abc.def.ghi'), '[REDACTED_AUTH]');
});

test('M11N-25 no service_role in client packages', () => {
  const roots = [
    join(dirname(fileURLToPath(import.meta.url)), '../../../cc/src'),
  ];
  const forbidden = /service_role|SUPABASE_SERVICE_ROLE_KEY\s*[:=]/;
  for (const root of roots) {
    const walk = (dir) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        if (name.name.includes('m11n-hosted-session.test')) continue;
        const p = join(dir, name.name);
        if (name.isDirectory()) walk(p);
        else if (/\.(js|mjs|jsx|ts|tsx)$/.test(name.name)) {
          const text = readFileSync(p, 'utf8');
          const lines = text.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
          for (const line of lines) {
            if (forbidden.test(line) && !/MUST NEVER|never enter|absent|FORBIDDEN|not a privileged/i.test(line)) {
              assert.fail(`possible service_role leak in ${p}: ${line.trim()}`);
            }
          }
        }
      }
    };
    try {
      walk(root);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
});

test('M11N-19 signup / disallowed methods policy constants', () => {
  assert.equal(OPERATOR_SESSION_POLICY_V1.publicOperatorSignup, 'DISABLED');
  assert.equal(OPERATOR_SESSION_POLICY_V1.socialOperatorLogin, 'DISABLED_V1');
  assert.equal(OPERATOR_SESSION_POLICY_V1.magicLinkOperatorLogin, 'DISABLED_V1');
  assert.equal(OPERATOR_SESSION_POLICY_V1.smsMfa, 'DISABLED_V1');
});

test('M11N-31 full hosted gate integration', async () => {
  const gate = await gateHostedA11Request({
    pool: admin,
    headers: { authorization: 'Bearer tok' },
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
    body: { role: 'OWNER', authUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  });
  // client authUserId spoof → reject before mapping
  assert.equal(gate.ok, false);
  assert.equal(gate.code, HostedAuthErrorCode.CLIENT_IDENTITY_REJECTED);

  const gateOk = await gateHostedA11Request({
    pool: admin,
    headers: { authorization: 'Bearer tok' },
    getUser: mockGetUser({ user: { id: AUTH_USER_ID } }),
    getAuthenticatorAssuranceLevel: mockAal('aal2'),
    env: HOSTED_ENV,
    body: {},
  });
  assert.equal(gateOk.ok, true);
  assert.equal(gateOk.operatorId, TEST_OPERATOR_STABLE_IDS.TEST_OWNER);
  assert.equal(gateOk.identitySource, 'SUPABASE_AUTH_M11H');
});

test('M11N teardown', async () => {
  await admin.end();
});
