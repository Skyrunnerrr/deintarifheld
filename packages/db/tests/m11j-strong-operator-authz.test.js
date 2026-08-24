/**
 * DTH-M11J Strong server-side operator authorization — local disposable proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  OperatorRole,
  OperatorCapability,
  OperatorCommandType,
  COMMAND_REQUIRED_CAPABILITY,
  A11ErrorCode,
  A11_PROTECTED_VIEW_CAPABILITY,
  TEST_OPERATOR_STABLE_IDS,
} from '@deintarifheld/shared';
import {
  authorizeOperatorAction,
  authorizeOperatorRead,
  authorizeOperatorCommand,
  OperatorAuthzCode,
  executeOperatorCommand,
  bootstrapE2TestOperatorAuthority,
} from '../src/index.js';
import { createOpsBff } from '@deintarifheld/ops-api';
import { authenticateTestOperator, gateA11Request } from '@deintarifheld/ops-api';

const DB_URL =
  process.env.DTH_M11J_DATABASE_URL ||
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
    const sql = readFileSync(join(migDir, f), 'utf8');
    await admin.query(sql);
  }
}

function trustedIdentity(label) {
  const auth = authenticateTestOperator({
    identity: label,
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  assert.equal(auth.ok, true);
  const id = gateA11Request({ principal: auth.principal, session: auth.session });
  assert.equal(id.ok, true);
  assert.ok(id.operatorId);
  return id;
}

async function assignRole(operatorId, roleCode) {
  await admin.query(
    `UPDATE security.operator_role_assignments
     SET status = 'REVOKED', revoked_at = now(), updated_at = now()
     WHERE operator_id = $1::uuid AND status = 'ACTIVE'`,
    [operatorId],
  );
  const { rows } = await admin.query(
    `SELECT COALESCE(MAX(authority_version), 0) + 1 AS v
     FROM security.operator_role_assignments WHERE operator_id = $1::uuid`,
    [operatorId],
  );
  const version = Number(rows[0].v);
  await admin.query(
    `INSERT INTO security.operator_role_assignments
       (operator_id, role_code, status, authority_version)
     VALUES ($1::uuid, $2, 'ACTIVE', $3)`,
    [operatorId, roleCode, version],
  );
  return version;
}

test('M11J-00 apply migrations + bootstrap', async () => {
  await applyBaseMigrations();
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11J-04 command manifest complete', () => {
  for (const cmd of Object.values(OperatorCommandType)) {
    assert.ok(COMMAND_REQUIRED_CAPABILITY[cmd], cmd);
  }
});

test('M11J-05 view manifest complete', () => {
  assert.ok(A11_PROTECTED_VIEW_CAPABILITY.audit);
  assert.ok(A11_PROTECTED_VIEW_CAPABILITY.overview);
});

for (const [label, role, cap, allowed] of [
  ['TEST_VIEWER', OperatorRole.VIEWER, OperatorCapability.GLOBAL_KILL_MANAGE, false],
  ['TEST_OPERATOR', OperatorRole.OPERATOR, OperatorCapability.TASK_WRITE, true],
  ['TEST_APPROVER', OperatorRole.APPROVER, OperatorCapability.APPROVAL_DECIDE, true],
  ['TEST_OWNER', OperatorRole.OWNER, OperatorCapability.GLOBAL_KILL_MANAGE, true],
]) {
  test(`M11J role auth ${label}`, async () => {
    const id = trustedIdentity(label);
    const auth = await authorizeOperatorAction(admin, {
      operatorId: id.operatorId,
      requiredCapability: cap,
    });
    assert.equal(auth.ok, allowed);
  });
}

test('M11J-10 no OWNER wildcard path', async () => {
  const ownerId = TEST_OPERATOR_STABLE_IDS.TEST_OWNER;
  await admin.query(
    `DELETE FROM security.role_capabilities WHERE role_code = 'OWNER' AND capability_code = 'GLOBAL_KILL_MANAGE'`,
  );
  const auth = await authorizeOperatorAction(admin, {
    operatorId: ownerId,
    requiredCapability: OperatorCapability.GLOBAL_KILL_MANAGE,
  });
  assert.equal(auth.ok, false);
  await admin.query(readFileSync(join(migDir, '20260822150000_m11i_operator_role_capability_mapping.sql'), 'utf8'));
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11J-11 disabled operator denied', async () => {
  const id = trustedIdentity('TEST_OWNER');
  await admin.query(`UPDATE security.operators SET status = 'DISABLED' WHERE operator_id = $1::uuid`, [
    id.operatorId,
  ]);
  const auth = await authorizeOperatorCommand(admin, {
    operatorId: id.operatorId,
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
  });
  assert.equal(auth.ok, false);
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11J-12 no role denied', async () => {
  const { rows } = await admin.query(
    `INSERT INTO security.operators (display_label, status) VALUES ('No Role', 'ACTIVE') RETURNING operator_id`,
  );
  const auth = await authorizeOperatorRead(admin, {
    operatorId: rows[0].operator_id,
    requiredCapability: OperatorCapability.CASE_VIEW,
  });
  assert.equal(auth.code, OperatorAuthzCode.NO_ROLE_ASSIGNMENT);
});

test('M11J-13 DB unavailable fail closed', async () => {
  const dead = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:1/none' });
  const auth = await authorizeOperatorAction(dead, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
    requiredCapability: OperatorCapability.CASE_VIEW,
  });
  await dead.end().catch(() => {});
  assert.equal(auth.ok, false);
  assert.equal(auth.code, OperatorAuthzCode.AUTHORITY_DATA_UNAVAILABLE);
});

test('M11J-14 stale authority version', async () => {
  const id = trustedIdentity('TEST_OWNER');
  const current = await authorizeOperatorAction(admin, {
    operatorId: id.operatorId,
    requiredCapability: OperatorCapability.GLOBAL_KILL_MANAGE,
  });
  await assignRole(id.operatorId, OperatorRole.VIEWER);
  const stale = await authorizeOperatorAction(admin, {
    operatorId: id.operatorId,
    requiredCapability: OperatorCapability.GLOBAL_KILL_MANAGE,
    expectedAuthorityVersion: current.authorityVersion,
  });
  assert.equal(stale.code, OperatorAuthzCode.STALE_AUTHORITY_VERSION);
  assert.equal(stale.a11Code, A11ErrorCode.STALE_OPERATOR_VIEW);
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11J-16 client role forgery', async () => {
  const id = trustedIdentity('TEST_VIEWER');
  const auth = await authorizeOperatorCommand(admin, {
    operatorId: id.operatorId,
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
    clientRole: OperatorRole.OWNER,
  });
  assert.equal(auth.ok, false);
});

test('M11J-17 client capability forgery', async () => {
  const id = trustedIdentity('TEST_VIEWER');
  const auth = await authorizeOperatorAction(admin, {
    operatorId: id.operatorId,
    requiredCapability: OperatorCapability.CASE_VIEW,
    clientCapabilities: [OperatorCapability.GLOBAL_KILL_MANAGE],
  });
  assert.equal(auth.ok, false);
});

test('M11J-22 approval enforcement', async () => {
  const op = trustedIdentity('TEST_OPERATOR');
  const denied = await executeOperatorCommand(
    admin,
    {
      commandType: OperatorCommandType.APPROVE_OFFER,
      targetId: randomUUID(),
      idempotencyKey: `m11j-${randomUUID()}`,
    },
    op,
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.code, A11ErrorCode.NOT_AUTHORIZED);
});

test('M11J-23 global kill enforcement', async () => {
  const viewer = trustedIdentity('TEST_VIEWER');
  const denied = await executeOperatorCommand(
    admin,
    {
      commandType: OperatorCommandType.SET_GLOBAL_KILL,
      active: true,
      reason: 'deny',
      confirm: true,
      idempotencyKey: `m11j-${randomUUID()}`,
    },
    viewer,
  );
  assert.equal(denied.ok, false);
  const owner = trustedIdentity('TEST_OWNER');
  const ok = await executeOperatorCommand(
    admin,
    {
      commandType: OperatorCommandType.SET_GLOBAL_KILL,
      active: true,
      reason: 'allow',
      confirm: true,
      idempotencyKey: `m11j-${randomUUID()}`,
    },
    owner,
  );
  assert.equal(ok.ok, true);
});

test('M11J-31 protected reads via BFF', async () => {
  const bff = createOpsBff({ pool: admin });
  const viewerAuth = authenticateTestOperator({
    identity: 'TEST_VIEWER',
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  const overview = await bff.dispatch({
    method: 'GET',
    path: '/ops/v1/a11/overview',
    principal: viewerAuth.principal,
    session: viewerAuth.session,
  });
  assert.equal(overview.status, 200);
  const audit = await bff.dispatch({
    method: 'GET',
    path: '/ops/v1/a11/audit',
    principal: viewerAuth.principal,
    session: viewerAuth.session,
  });
  assert.equal(audit.status, 200);
  await bff.close().catch(() => {});
});

test('M11J-33 direct endpoint bypass', async () => {
  const bff = createOpsBff({ pool: admin });
  const missing = await bff.dispatch({ method: 'GET', path: '/ops/v1/a11/cases' });
  assert.equal(missing.status, 401);
  await bff.close().catch(() => {});
});

test('M11J-36 authority version stored on command', async () => {
  const owner = trustedIdentity('TEST_OWNER');
  const key = `m11j-audit-${randomUUID()}`;
  await executeOperatorCommand(
    admin,
    {
      commandType: OperatorCommandType.SET_GLOBAL_KILL,
      active: false,
      reason: 'off',
      confirm: true,
      idempotencyKey: key,
    },
    owner,
  );
  const { rows } = await admin.query(
    `SELECT operator_id, authority_version, required_capability FROM ops.operator_commands WHERE idempotency_key = $1`,
    [key],
  );
  assert.equal(rows[0].operator_id, owner.operatorId);
  assert.ok(rows[0].authority_version > 0);
  assert.equal(rows[0].required_capability, OperatorCapability.GLOBAL_KILL_MANAGE);
});

test('M11J-37 hosted test identity blocked in production mode', () => {
  const prod = authenticateTestOperator({
    identity: 'TEST_OWNER',
    env: { NODE_ENV: 'production', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  assert.equal(prod.ok, false);
});

test('M11J teardown', async () => {
  await admin.end();
});
