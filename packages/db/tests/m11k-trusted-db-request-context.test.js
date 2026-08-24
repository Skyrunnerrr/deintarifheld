/**
 * DTH-M11K Trusted database request context — local disposable proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  OperatorCapability,
  OperatorCommandType,
  TEST_OPERATOR_STABLE_IDS,
} from '@deintarifheld/shared';
import {
  authorizeOperatorAction,
  authorizeOperatorCommand,
  OperatorAuthzCode,
  buildTrustedDbRequestContext,
  installOperatorRequestContext,
  readCurrentOperatorRequestContext,
  withAuthorizedOperatorTransaction,
  OperatorDbContextCode,
  executeOperatorCommand,
  bootstrapE2TestOperatorAuthority,
} from '../src/index.js';
import { authenticateTestOperator, gateA11Request } from '@deintarifheld/ops-api';

const DB_URL =
  process.env.DTH_M11K_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
const MIGRATIONS = [
  '20260821120000_m11f_runtime_login_roles.sql',
  '20260822100000_m11g_workload_privilege_groups.sql',
  '20260822110000_m11g_runtime_least_privilege_grants.sql',
  '20260822120000_m11g_legacy_acl_and_default_privileges.sql',
  '20260822130000_m11g_intake_rls_policies.sql',
  '20260822140000_m11h_operator_identity_mapping.sql',
  '20260822150000_m11i_operator_role_capability_mapping.sql',
  '20260822160000_m11j_operator_command_authz.sql',
  '20260818180000_a11_command_center.sql',
];

const admin = new pg.Pool({ connectionString: DB_URL, max: 4 });

async function applyBaseMigrations() {
  for (const f of MIGRATIONS) {
    await admin.query(readFileSync(join(migDir, f), 'utf8'));
  }
}

function trustedIdentity(label) {
  const auth = authenticateTestOperator({
    identity: label,
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  const id = gateA11Request({ principal: auth.principal, session: auth.session });
  assert.equal(id.ok, true);
  return id;
}

async function ownerAuth() {
  return authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
    requiredCapability: OperatorCapability.GLOBAL_KILL_MANAGE,
  });
}

test('M11K-00 apply migrations + bootstrap', async () => {
  await applyBaseMigrations();
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11K-02 trusted context from M11J only', () => {
  assert.throws(
    () => buildTrustedDbRequestContext({ ok: false, code: 'CAPABILITY_DENIED' }, 'req-1'),
    /TRUSTED_CONTEXT_REQUIRES_AUTHORIZED_M11J/,
  );
  const auth = {
    ok: true,
    code: OperatorAuthzCode.AUTHORIZED,
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
    authorityVersion: 1,
    requiredCapability: OperatorCapability.GLOBAL_KILL_MANAGE,
  };
  const ctx = buildTrustedDbRequestContext(auth, 'req-abc');
  assert.equal(ctx.operatorId, TEST_OPERATOR_STABLE_IDS.TEST_OWNER);
  assert.equal(ctx.requiredCapability, OperatorCapability.GLOBAL_KILL_MANAGE);
  assert.equal(ctx.requestId, 'req-abc');
});

test('M11K-08 transaction-local context', async () => {
  const auth = await ownerAuth();
  const requestId = randomUUID();
  await withAuthorizedOperatorTransaction(admin, { authzEvidence: auth, requestId }, async (client) => {
    const live = await readCurrentOperatorRequestContext(client);
    assert.equal(live.ok, true);
    assert.equal(live.context.operatorId, auth.operatorId);
    assert.equal(live.context.authorityVersion, auth.authorityVersion);
    assert.equal(live.context.requiredCapability, auth.requiredCapability);
    assert.equal(live.context.requestId, requestId);
  });
});

test('M11K-09 context absent outside transaction', async () => {
  const { rows } = await admin.query(
    `SELECT NULLIF(current_setting('dth.operator_id', true), '') AS operator_id`,
  );
  assert.equal(rows[0].operator_id, null);
  const client = await admin.connect();
  try {
    const outside = await readCurrentOperatorRequestContext(client);
    assert.equal(outside.code, OperatorDbContextCode.NO_CONTEXT);
  } finally {
    client.release();
  }
});

test('M11K-10 commit clears context / M11K-12 pool reuse no leak', async () => {
  const leakPool = new pg.Pool({ connectionString: DB_URL, max: 1 });
  const auth = await ownerAuth();
  await withAuthorizedOperatorTransaction(leakPool, { authzEvidence: auth, requestId: 'leak-a' }, async (client) => {
    const live = await readCurrentOperatorRequestContext(client);
    assert.equal(live.ok, true);
  });

  const client = await leakPool.connect();
  try {
    const after = await readCurrentOperatorRequestContext(client);
    assert.equal(after.code, OperatorDbContextCode.NO_CONTEXT);
  } finally {
    client.release();
    await leakPool.end();
  }
});

test('M11K-11 rollback clears context', async () => {
  const leakPool = new pg.Pool({ connectionString: DB_URL, max: 1 });
  const auth = await ownerAuth();
  const client = await leakPool.connect();
  try {
    await client.query('BEGIN');
    await installOperatorRequestContext(client, buildTrustedDbRequestContext(auth, 'rb-1'));
    const live = await readCurrentOperatorRequestContext(client);
    assert.equal(live.ok, true);
    await client.query('ROLLBACK');
    const after = await readCurrentOperatorRequestContext(client);
    assert.equal(after.code, OperatorDbContextCode.NO_CONTEXT);
  } finally {
    client.release();
    await leakPool.end();
  }
});

test('M11K-13 concurrent operator isolation', async () => {
  const owner = await authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
    requiredCapability: OperatorCapability.NOTE_WRITE,
  });
  const viewer = await authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_VIEWER,
    requiredCapability: OperatorCapability.CASE_VIEW,
  });

  await Promise.all([
    withAuthorizedOperatorTransaction(admin, { authzEvidence: owner, requestId: 'c-owner' }, async (client) => {
      const live = await readCurrentOperatorRequestContext(client);
      assert.equal(live.context.operatorId, TEST_OPERATOR_STABLE_IDS.TEST_OWNER);
      await new Promise((r) => setTimeout(r, 30));
      const again = await readCurrentOperatorRequestContext(client);
      assert.equal(again.context.operatorId, TEST_OPERATOR_STABLE_IDS.TEST_OWNER);
    }),
    withAuthorizedOperatorTransaction(admin, { authzEvidence: viewer, requestId: 'c-viewer' }, async (client) => {
      const live = await readCurrentOperatorRequestContext(client);
      assert.equal(live.context.operatorId, TEST_OPERATOR_STABLE_IDS.TEST_VIEWER);
    }),
  ]);
});

test('M11K-14 invalid operator_id rejected', async () => {
  const auth = await ownerAuth();
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      () =>
        installOperatorRequestContext(client, {
          ...buildTrustedDbRequestContext(auth, 'x'),
          operatorId: 'not-a-uuid',
        }),
      /INVALID_OPERATOR_REQUEST_CONTEXT/,
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});

test('M11K-16 invalid capability rejected', async () => {
  const auth = await ownerAuth();
  assert.throws(
    () =>
      buildTrustedDbRequestContext(
        { ...auth, requiredCapability: 'FAKE_CAPABILITY' },
        'bad-cap',
      ),
    /TRUSTED_CONTEXT_INVALID/,
  );
});

test('M11K-17 client context forgery cannot authorize', async () => {
  const forged = await authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_VIEWER,
    requiredCapability: OperatorCapability.GLOBAL_KILL_MANAGE,
    clientRole: 'OWNER',
    clientCapabilities: [OperatorCapability.GLOBAL_KILL_MANAGE],
    clientOperatorId: TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
  });
  assert.equal(forged.ok, false);
  assert.throws(
    () => buildTrustedDbRequestContext(forged, 'forged'),
    /TRUSTED_CONTEXT_REQUIRES_AUTHORIZED_M11J/,
  );
});

test('M11K-20 protected transaction without auth denied', async () => {
  const r = await withAuthorizedOperatorTransaction(
    admin,
    { authzEvidence: { ok: false, code: OperatorAuthzCode.CAPABILITY_DENIED }, requestId: 'no-auth' },
    async () => ({ ok: true }),
  );
  assert.equal(r.ok, false);
});

test('M11K-23 downgrade between authz and write blocked', async () => {
  const operatorId = TEST_OPERATOR_STABLE_IDS.TEST_OWNER;
  const auth = await authorizeOperatorCommand(admin, {
    operatorId,
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
  });
  assert.equal(auth.ok, true);
  await admin.query(
    `UPDATE security.operator_role_assignments
     SET status = 'REVOKED', revoked_at = now(), updated_at = now()
     WHERE operator_id = $1::uuid AND status = 'ACTIVE'`,
    [operatorId],
  );
  await admin.query(
    `INSERT INTO security.operator_role_assignments
       (operator_id, role_code, status, authority_version)
     VALUES ($1::uuid, 'VIEWER', 'ACTIVE', $2)`,
    [operatorId, auth.authorityVersion + 1],
  );
  const txn = await withAuthorizedOperatorTransaction(
    admin,
    { authzEvidence: auth, requestId: 'stale-write' },
    async () => ({ ok: true, effect: 1 }),
  );
  assert.equal(txn.ok, false);
  assert.equal(txn.code, OperatorDbContextCode.STALE_AUTHORITY);
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11K-25 command stores matching operator context evidence', async () => {
  const identity = trustedIdentity('TEST_OWNER');
  const idempotencyKey = `m11k-kill-${randomUUID()}`;
  const result = await executeOperatorCommand(
    admin,
    {
      commandType: OperatorCommandType.SET_GLOBAL_KILL,
      active: true,
      reason: 'M11K context binding',
      confirm: true,
      idempotencyKey,
      correlationId: idempotencyKey,
    },
    identity,
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  const { rows } = await admin.query(
    `SELECT operator_id, authority_version, required_capability, correlation_id
     FROM ops.operator_commands WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  assert.equal(rows[0].operator_id, identity.operatorId);
  assert.equal(rows[0].required_capability, OperatorCapability.GLOBAL_KILL_MANAGE);
  assert.ok(Number(rows[0].authority_version) >= 1);
  assert.equal(rows[0].correlation_id, idempotencyKey);
});

test('M11K teardown', async () => {
  await admin.end();
});
