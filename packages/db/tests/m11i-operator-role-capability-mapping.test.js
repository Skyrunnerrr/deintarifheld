/**
 * DTH-M11I Operator role + capability mapping — local disposable proof.
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
  ROLE_CAPABILITIES,
  COMMAND_REQUIRED_CAPABILITY,
  OperatorCommandType,
} from '@deintarifheld/shared';
import {
  resolveOperatorAuthority,
  rejectClientOperatorRole,
  rejectClientOperatorCapabilities,
  OperatorAuthorityResolutionCode,
} from '../src/a11/operator-authority.js';

const DB_URL =
  process.env.DTH_M11I_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const LOGIN = { intake: 'dth_public_intake', worker: 'dth_worker', ops: 'dth_ops_api' };
const LOCAL_TEST_PASSWORD = process.env.DTH_M11I_TEST_PASSWORD || 'm11i-local-only-not-for-prod';
const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
const MIGRATIONS = [
  '20260821120000_m11f_runtime_login_roles.sql',
  '20260822100000_m11g_workload_privilege_groups.sql',
  '20260822110000_m11g_runtime_least_privilege_grants.sql',
  '20260822120000_m11g_legacy_acl_and_default_privileges.sql',
  '20260822130000_m11g_intake_rls_policies.sql',
  '20260822140000_m11h_operator_identity_mapping.sql',
  '20260822150000_m11i_operator_role_capability_mapping.sql',
];

const admin = new pg.Pool({ connectionString: DB_URL, max: 4 });

function roleUrl(role) {
  const u = new URL(DB_URL);
  u.username = role;
  u.password = LOCAL_TEST_PASSWORD;
  return u.toString();
}

function rolePool(role) {
  return new pg.Pool({ connectionString: roleUrl(role), max: 2 });
}

async function applyMigrations() {
  for (const f of MIGRATIONS) {
    const sql = readFileSync(join(migDir, f), 'utf8');
    assert.doesNotMatch(sql, /\bPASSWORD\s+'/i);
    await admin.query(sql);
  }
  for (const role of Object.values(LOGIN)) {
    await admin.query(
      `ALTER ROLE ${pg.escapeIdentifier(role)} WITH PASSWORD ${pg.escapeLiteral(LOCAL_TEST_PASSWORD)}`,
    );
  }
}

async function seedOperator({ label = 'M11I Test Operator' } = {}) {
  const { rows } = await admin.query(
    `INSERT INTO security.operators (display_label, status)
     VALUES ($1, 'ACTIVE')
     RETURNING operator_id`,
    [label],
  );
  return rows[0].operator_id;
}

async function nextAuthorityVersion(operatorId) {
  const { rows } = await admin.query(
    `SELECT COALESCE(MAX(authority_version), 0) + 1 AS v
     FROM security.operator_role_assignments WHERE operator_id = $1::uuid`,
    [operatorId],
  );
  return Number(rows[0].v);
}

async function assignRole(operatorId, roleCode) {
  await admin.query(
    `UPDATE security.operator_role_assignments
     SET status = 'REVOKED', revoked_at = now(), updated_at = now()
     WHERE operator_id = $1::uuid AND status = 'ACTIVE'`,
    [operatorId],
  );
  const version = await nextAuthorityVersion(operatorId);
  await admin.query(
    `INSERT INTO security.operator_role_assignments
       (operator_id, role_code, status, authority_version)
     VALUES ($1::uuid, $2, 'ACTIVE', $3)`,
    [operatorId, roleCode, version],
  );
  return version;
}

async function hasTablePriv(role, table, priv) {
  const { rows } = await admin.query(`SELECT has_table_privilege($1,$2,$3) AS ok`, [role, table, priv]);
  return rows[0].ok;
}

async function publicHasTablePriv(qualifiedTable, priv) {
  const { rows } = await admin.query(
    `SELECT EXISTS (
       SELECT 1
       FROM aclexplode((
         SELECT c.relacl
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE format('%I.%I', n.nspname, c.relname) = $1
       )) a
       WHERE a.grantee = 0 AND a.privilege_type = $2
     ) AS ok`,
    [qualifiedTable, priv],
  );
  return rows[0].ok;
}

function sortedCaps(caps) {
  return [...caps].sort();
}

test('M11I-00 apply migrations', async () => {
  await applyMigrations();
});

test('M11I-01/02 role catalog', async () => {
  const { rows } = await admin.query(
    `SELECT role_code FROM security.operator_roles WHERE status = 'ACTIVE' ORDER BY 1`,
  );
  assert.deepEqual(
    rows.map((r) => r.role_code),
    ['APPROVER', 'OPERATOR', 'OWNER', 'VIEWER'],
  );
});

test('M11I-03 capability catalog', async () => {
  const { rows } = await admin.query(`SELECT COUNT(*)::int AS n FROM security.operator_capabilities`);
  assert.equal(rows[0].n, Object.keys(OperatorCapability).length);
});

test('M11I-04 capability source completeness', async () => {
  const { rows } = await admin.query(`SELECT capability_code FROM security.operator_capabilities`);
  const dbCaps = new Set(rows.map((r) => r.capability_code));
  for (const cap of Object.values(OperatorCapability)) {
    assert.ok(dbCaps.has(cap), `missing capability ${cap}`);
  }
  for (const cap of Object.values(COMMAND_REQUIRED_CAPABILITY)) {
    assert.ok(dbCaps.has(cap), `command capability missing ${cap}`);
  }
});

test('M11I-05 role-capability matrix matches A11 contracts', async () => {
  for (const [role, expectedCaps] of Object.entries(ROLE_CAPABILITIES)) {
    const explicitExpected =
      role === OperatorRole.OWNER ? Object.values(OperatorCapability) : expectedCaps;
    const { rows } = await admin.query(
      `SELECT capability_code FROM security.role_capabilities WHERE role_code = $1 ORDER BY 1`,
      [role],
    );
    assert.deepEqual(
      rows.map((r) => r.capability_code),
      sortedCaps(explicitExpected),
      `matrix mismatch for ${role}`,
    );
  }
});

for (const [role, label] of [
  [OperatorRole.VIEWER, 'M11I-06 VIEWER authority'],
  [OperatorRole.OPERATOR, 'M11I-07 OPERATOR authority'],
  [OperatorRole.APPROVER, 'M11I-08 APPROVER authority'],
  [OperatorRole.OWNER, 'M11I-09 OWNER explicit authority'],
]) {
  test(label, async () => {
    const operatorId = await seedOperator({ label: role });
    await assignRole(operatorId, role);
    const pool = rolePool(LOGIN.ops);
    const res = await resolveOperatorAuthority(pool, { operatorId });
    await pool.end();
    assert.equal(res.ok, true);
    assert.equal(res.role, role);
    const expected =
      role === OperatorRole.OWNER ? Object.values(OperatorCapability) : ROLE_CAPABILITIES[role];
    assert.deepEqual(sortedCaps(res.capabilities), sortedCaps(expected));
    if (role === OperatorRole.VIEWER) {
      assert.ok(!res.capabilities.includes(OperatorCapability.GLOBAL_KILL_MANAGE));
      assert.ok(!res.capabilities.includes(OperatorCapability.TASK_WRITE));
    }
    if (role === OperatorRole.OPERATOR) {
      assert.ok(!res.capabilities.includes(OperatorCapability.APPROVAL_DECIDE));
      assert.ok(!res.capabilities.includes(OperatorCapability.GLOBAL_KILL_MANAGE));
    }
  });
}

test('M11I-10 no OWNER wildcard in resolver', async () => {
  const operatorId = await seedOperator({ label: 'Owner explicit' });
  await assignRole(operatorId, OperatorRole.OWNER);
  const pool = rolePool(LOGIN.ops);
  const res = await resolveOperatorAuthority(pool, { operatorId });
  await pool.end();
  const { rows } = await admin.query(`SELECT COUNT(*)::int AS n FROM security.operator_capabilities`);
  assert.equal(res.capabilities.length, rows[0].n);
  assert.ok(res.capabilities.includes(OperatorCapability.GLOBAL_KILL_MANAGE));
});

test('M11I-11 operator assignment + M11I-12 one active role', async () => {
  const operatorId = await seedOperator();
  await assignRole(operatorId, OperatorRole.VIEWER);
  await assert.rejects(
    () =>
      admin.query(
        `INSERT INTO security.operator_role_assignments
           (operator_id, role_code, status, authority_version)
         VALUES ($1::uuid, 'OPERATOR', 'ACTIVE', 99)`,
        [operatorId],
      ),
    /unique|duplicate/i,
  );
});

test('M11I-13 no role denial', async () => {
  const operatorId = await seedOperator({ label: 'No role' });
  const pool = rolePool(LOGIN.ops);
  const res = await resolveOperatorAuthority(pool, { operatorId });
  await pool.end();
  assert.equal(res.ok, false);
  assert.equal(res.code, OperatorAuthorityResolutionCode.NO_ROLE_ASSIGNMENT);
  assert.deepEqual(res.capabilities, []);
  assert.equal(res.authority, 0);
});

test('M11I-14 disabled operator denial', async () => {
  const operatorId = await seedOperator({ label: 'Disabled owner' });
  await assignRole(operatorId, OperatorRole.OWNER);
  await admin.query(`UPDATE security.operators SET status = 'DISABLED' WHERE operator_id = $1::uuid`, [
    operatorId,
  ]);
  const pool = rolePool(LOGIN.ops);
  const res = await resolveOperatorAuthority(pool, { operatorId });
  await pool.end();
  assert.equal(res.code, OperatorAuthorityResolutionCode.OPERATOR_DISABLED);
  assert.deepEqual(res.capabilities, []);
});

test('M11I-15 unknown role denial', async () => {
  const operatorId = await seedOperator({ label: 'Unknown role test' });
  await assert.rejects(
    () =>
      admin.query(
        `INSERT INTO security.operator_role_assignments
           (operator_id, role_code, status, authority_version)
         VALUES ($1::uuid, 'SUPERADMIN', 'ACTIVE', 1)`,
        [operatorId],
      ),
    /violates foreign key/,
  );
});

test('M11I-16/17/18 client role and capabilities ignored', () => {
  assert.equal(rejectClientOperatorRole({ clientRole: OperatorRole.OWNER }).ok, false);
  assert.equal(
    rejectClientOperatorCapabilities({ clientCapabilities: [OperatorCapability.GLOBAL_KILL_MANAGE] }).ok,
    false,
  );
});

test('M11I-19 ops_api read', async () => {
  for (const table of [
    'security.operator_roles',
    'security.operator_capabilities',
    'security.role_capabilities',
    'security.operator_role_assignments',
  ]) {
    assert.equal(await hasTablePriv(LOGIN.ops, table, 'SELECT'), true);
  }
});

test('M11I-20 ops_api admin writes denied', async () => {
  const operatorId = await seedOperator();
  const client = new pg.Client({ connectionString: roleUrl(LOGIN.ops) });
  await client.connect();
  try {
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO security.operator_role_assignments
             (operator_id, role_code, status, authority_version)
           VALUES ($1::uuid, 'OWNER', 'ACTIVE', 1)`,
          [operatorId],
        ),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO security.role_capabilities (role_code, capability_code)
           VALUES ('VIEWER', 'GLOBAL_KILL_MANAGE')`,
        ),
      /permission denied/,
    );
  } finally {
    await client.end();
  }
});

test('M11I-21 worker denied', async () => {
  assert.equal(await hasTablePriv(LOGIN.worker, 'security.operator_roles', 'SELECT'), false);
  assert.equal(await hasTablePriv(LOGIN.worker, 'security.operator_role_assignments', 'SELECT'), false);
});

test('M11I-22 intake denied', async () => {
  assert.equal(await hasTablePriv(LOGIN.intake, 'security.role_capabilities', 'SELECT'), false);
});

test('M11I-23 authenticated denied when present', async () => {
  for (const role of ['anon', 'authenticated']) {
    const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [role]);
    if (!exists.rowCount) continue;
    assert.equal(await hasTablePriv(role, 'security.operator_roles', 'SELECT'), false);
  }
});

test('M11I-25 authority version changes on role change', async () => {
  const operatorId = await seedOperator({ label: 'Version test' });
  const v1 = await assignRole(operatorId, OperatorRole.VIEWER);
  const pool = rolePool(LOGIN.ops);
  const first = await resolveOperatorAuthority(pool, { operatorId });
  const v2 = await assignRole(operatorId, OperatorRole.OPERATOR);
  const second = await resolveOperatorAuthority(pool, { operatorId });
  await pool.end();
  assert.equal(first.authorityVersion, v1);
  assert.equal(second.authorityVersion, v2);
  assert.ok(second.authorityVersion > first.authorityVersion);
  assert.equal(second.role, OperatorRole.OPERATOR);
});

test('M11I-26 role history preserved', async () => {
  const operatorId = await seedOperator({ label: 'History' });
  await assignRole(operatorId, OperatorRole.VIEWER);
  await assignRole(operatorId, OperatorRole.APPROVER);
  const { rows } = await admin.query(
    `SELECT status, role_code FROM security.operator_role_assignments
     WHERE operator_id = $1::uuid ORDER BY authority_version`,
    [operatorId],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, 'REVOKED');
  assert.equal(rows[0].role_code, OperatorRole.VIEWER);
  assert.equal(rows[1].status, 'ACTIVE');
  assert.equal(rows[1].role_code, OperatorRole.APPROVER);
});

test('M11I-27 command capability coverage', () => {
  const mappedCaps = new Set(Object.values(COMMAND_REQUIRED_CAPABILITY));
  for (const cmd of Object.values(OperatorCommandType)) {
    assert.ok(
      COMMAND_REQUIRED_CAPABILITY[cmd],
      `unmapped command ${cmd}`,
    );
    assert.ok(mappedCaps.has(COMMAND_REQUIRED_CAPABILITY[cmd]));
  }
});

test('M11I-28 view capability manifest baseline', () => {
  const views = {
    'a11/overview': OperatorCapability.CASE_VIEW,
    'a11/inbox': OperatorCapability.CASE_VIEW,
    'a11/cases': OperatorCapability.CASE_VIEW,
    'a11/case-detail': OperatorCapability.CASE_VIEW,
    'a11/approvals': OperatorCapability.CASE_VIEW,
    'a11/jobs': OperatorCapability.CASE_VIEW,
    'a11/lifecycle': OperatorCapability.CASE_VIEW,
    'a11/controls': OperatorCapability.CASE_VIEW,
    'a11/audit': OperatorCapability.AUDIT_VIEW,
    'a11/readiness': OperatorCapability.CASE_VIEW,
  };
  for (const cap of Object.values(views)) {
    assert.ok(Object.values(OperatorCapability).includes(cap));
  }
});

test('M11I-29 default privileges on synthetic future security table', async () => {
  const table = `m11i_future_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  await admin.query(`CREATE TABLE security.${table} (id int)`);
  try {
    for (const role of [LOGIN.intake, LOGIN.worker, LOGIN.ops, 'anon', 'authenticated']) {
      const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [role]);
      if (!exists.rowCount) continue;
      assert.equal(await hasTablePriv(role, `security.${table}`, 'SELECT'), false, role);
    }
    assert.equal(await publicHasTablePriv(`security.${table}`, 'SELECT'), false);
  } finally {
    await admin.query(`DROP TABLE security.${table}`);
  }
});

test('M11I-30 DB unavailable fail closed', async () => {
  const dead = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:1/none' });
  const res = await resolveOperatorAuthority(dead, { operatorId: randomUUID() });
  await dead.end().catch(() => {});
  assert.equal(res.code, OperatorAuthorityResolutionCode.AUTHORITY_DATA_UNAVAILABLE);
  assert.equal(res.authority, 0);
});

test('M11I-31 assignment to unknown operator rejected', async () => {
  await assert.rejects(
    () =>
      admin.query(
        `INSERT INTO security.operator_role_assignments
           (operator_id, role_code, status, authority_version)
         VALUES ($1::uuid, 'VIEWER', 'ACTIVE', 1)`,
        [randomUUID()],
      ),
    /violates foreign key/,
  );
});

test('M11I-32 no passwords in migration', () => {
  const sql = readFileSync(join(migDir, MIGRATIONS.at(-1)), 'utf8');
  assert.doesNotMatch(sql, /\b(jwt|refresh_token|access_token|password_hash)\b/i);
  const hits = readdirSync(migDir).filter(
    (f) => f.includes('m11i') && /\bPASSWORD\s+'/i.test(readFileSync(join(migDir, f), 'utf8')),
  );
  assert.deepEqual(hits, []);
});

test('M11I teardown', async () => {
  await admin.end();
});
