/**
 * DTH-M11L Database RLS enforcement foundation — local disposable proof.
 * Uses runtime login roles (not postgres) for RLS evidence.
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
  TEST_OPERATOR_STABLE_IDS,
} from '@deintarifheld/shared';
import {
  acceptBusinessLeadAtomic,
  authorizeOperatorAction,
  bootstrapE2TestOperatorAuthority,
  installOperatorRequestContext,
  buildTrustedDbRequestContext,
  readCurrentOperatorRequestContext,
  withAuthorizedOperatorTransaction,
  OperatorDbContextCode,
  readFreshControlSnapshot,
} from '../src/index.js';
import { KillDomain } from '@deintarifheld/shared';

const DB_URL =
  process.env.DTH_M11L_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const LOGIN = {
  intake: 'dth_public_intake',
  worker: 'dth_worker',
  ops: 'dth_ops_api',
};
const LOCAL_TEST_PASSWORD = process.env.DTH_M11L_TEST_PASSWORD || 'm11f-local-only-not-for-prod';

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
  '20260822170000_m11l_operator_context_rls.sql',
];

const PROTECTED_TABLES = [
  { schema: 'security', table: 'control_state' },
  { schema: 'security', table: 'control_version' },
  { schema: 'security', table: 'control_audit' },
  { schema: 'ops', table: 'operator_commands' },
];

const admin = new pg.Pool({ connectionString: DB_URL, max: 4 });

function roleUrl(role) {
  const u = new URL(DB_URL);
  u.username = role;
  u.password = LOCAL_TEST_PASSWORD;
  return u.toString();
}

async function asRole(role, fn) {
  const client = new pg.Client({ connectionString: roleUrl(role) });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function applyMigrations() {
  for (const f of MIGRATIONS) {
    await admin.query(readFileSync(join(migDir, f), 'utf8'));
  }
  for (const role of Object.values(LOGIN)) {
    await admin.query(
      `ALTER ROLE ${pg.escapeIdentifier(role)} WITH PASSWORD ${pg.escapeLiteral(LOCAL_TEST_PASSWORD)}`,
    );
  }
}

async function ownerAuth() {
  return authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
    requiredCapability: OperatorCapability.GLOBAL_KILL_MANAGE,
  });
}

async function viewerAuth() {
  return authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_VIEWER,
    requiredCapability: OperatorCapability.CASE_VIEW,
  });
}

test('M11L-00 apply migrations + bootstrap', async () => {
  await applyMigrations();
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11L-01 RLS inventory on protected operator tables', async () => {
  for (const { schema, table } of PROTECTED_TABLES) {
    const { rows } = await admin.query(
      `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2`,
      [schema, table],
    );
    assert.equal(rows[0]?.rls, true, `${schema}.${table} RLS`);
    assert.equal(rows[0]?.force_rls, true, `${schema}.${table} FORCE RLS`);
  }
});

test('M11L-03 runtime roles do not own protected tables', async () => {
  for (const role of Object.values(LOGIN)) {
    for (const { schema, table } of PROTECTED_TABLES) {
      const { rows } = await admin.query(
        `SELECT 1 FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_roles r ON r.oid = c.relowner
         WHERE n.nspname = $1 AND c.relname = $2 AND r.rolname = $3`,
        [schema, table, role],
      );
      assert.equal(rows.length, 0, `${role} owns ${schema}.${table}`);
    }
  }
});

test('M11L-04 runtime roles BYPASSRLS=NO', async () => {
  for (const role of Object.values(LOGIN)) {
    const { rows } = await admin.query(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname = $1`,
      [role],
    );
    assert.equal(rows[0]?.rolbypassrls, false, role);
  }
});

test('M11L-07 no-context deny on protected writes (dth_ops_api)', async () => {
  await asRole(LOGIN.ops, async (c) => {
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO security.control_audit
            (scope, scope_key, to_state, control_version, reason, actor)
           VALUES ('GLOBAL','AUTOMATION','ACTIVE',1,'m11l','NO_CTX')`,
        ),
      /row-level security|violates/,
    );
  });
  await asRole(LOGIN.ops, async (c) => {
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO ops.operator_commands
            (command_type, idempotency_key, operator_person_id, operator_role, payload_hash)
           VALUES ('GLOBAL_KILL','m11l-no-ctx', 'p','OWNER','abc')`,
        ),
      /row-level security|violates/,
    );
    const sel = await c.query(`SELECT COUNT(*)::int AS n FROM ops.operator_commands`);
    assert.equal(sel.rows[0].n, 0);
  });
});

test('M11L-08 valid context allows protected writes', async () => {
  const auth = await ownerAuth();
  const key = `m11l-ok-${randomUUID()}`;
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(
      c,
      buildTrustedDbRequestContext(auth, 'm11l-valid'),
    );
    await c.query(
      `INSERT INTO security.control_audit
        (scope, scope_key, to_state, control_version, reason, actor)
       VALUES ('GLOBAL','AUTOMATION','ACTIVE',1,'m11l-valid','CTX')`,
    );
    await c.query(
      `INSERT INTO ops.operator_commands
        (command_type, idempotency_key, operator_person_id, operator_role,
         operator_id, authority_version, required_capability, payload_hash)
       VALUES ($1,$2,'TEST_OWNER','OWNER',$3,$4,$5,'hash')`,
      [
        'GLOBAL_KILL',
        key,
        auth.operatorId,
        auth.authorityVersion,
        auth.requiredCapability,
      ],
    );
    await c.query('ROLLBACK');
  });
});

test('M11L-09 wrong capability denies high-impact write', async () => {
  const viewer = await viewerAuth();
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(
      c,
      buildTrustedDbRequestContext(viewer, 'm11l-wrong-cap'),
    );
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO security.control_state
            (scope, scope_key, state, reason, updated_by)
           VALUES ('GLOBAL','AUTOMATION','INACTIVE','m11l','VIEWER')`,
        ),
      /row-level security|violates/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11L-10 stale authority version denies', async () => {
  const auth = await ownerAuth();
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, {
      ...buildTrustedDbRequestContext(auth, 'm11l-stale'),
      authorityVersion: auth.authorityVersion - 1,
    });
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO security.control_audit
            (scope, scope_key, to_state, control_version)
           VALUES ('GLOBAL','X','ACTIVE',1)`,
        ),
      /row-level security|violates/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11L-11 disabled operator denies', async () => {
  const auth = await ownerAuth();
  await admin.query(
    `UPDATE security.operators SET status = 'DISABLED' WHERE operator_id = $1::uuid`,
    [auth.operatorId],
  );
  try {
    await asRole(LOGIN.ops, async (c) => {
      await c.query('BEGIN');
      await installOperatorRequestContext(
        c,
        buildTrustedDbRequestContext(auth, 'm11l-disabled'),
      );
      await assert.rejects(
        () =>
          c.query(
            `INSERT INTO security.control_audit
              (scope, scope_key, to_state, control_version)
             VALUES ('GLOBAL','X','ACTIVE',1)`,
          ),
        /row-level security|violates/,
      );
      await c.query('ROLLBACK');
    });
  } finally {
    await admin.query(
      `UPDATE security.operators SET status = 'ACTIVE' WHERE operator_id = $1::uuid`,
      [auth.operatorId],
    );
    await bootstrapE2TestOperatorAuthority(admin);
  }
});

test('M11L-12 unknown operator denies', async () => {
  const unknownId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('dth.operator_id', $1, true)`, [unknownId]);
    await c.query(`SELECT set_config('dth.authority_version', '1', true)`);
    await c.query(`SELECT set_config('dth.required_capability', 'GLOBAL_KILL_MANAGE', true)`);
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO security.control_audit
            (scope, scope_key, to_state, control_version)
           VALUES ('GLOBAL','X','ACTIVE',1)`,
        ),
      /row-level security|violates/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11L-13 row actor mismatch denies operator_commands insert', async () => {
  const auth = await ownerAuth();
  const viewerId = TEST_OPERATOR_STABLE_IDS.TEST_VIEWER;
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(
      c,
      buildTrustedDbRequestContext(auth, 'm11l-mismatch'),
    );
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO ops.operator_commands
            (command_type, idempotency_key, operator_person_id, operator_role,
             operator_id, authority_version, required_capability, payload_hash)
           VALUES ('GLOBAL_KILL',$1,'TEST_VIEWER','VIEWER',$2,$3,$4,'hash')`,
          [
            `m11l-mismatch-${randomUUID()}`,
            viewerId,
            auth.authorityVersion,
            auth.requiredCapability,
          ],
        ),
      /row-level security|violates/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11L-14 audit read requires AUDIT_VIEW capability', async () => {
  const viewer = await viewerAuth();
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(
      c,
      buildTrustedDbRequestContext(viewer, 'm11l-no-audit'),
    );
    const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM public.audit_events`);
    assert.equal(rows[0].n, 0);
    await c.query('ROLLBACK');
  });
});

test('M11L-15 worker control read preserved', async () => {
  const pool = new pg.Pool({ connectionString: roleUrl(LOGIN.worker), max: 1 });
  const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
  assert.ok(typeof snap.mayClaim === 'boolean');
  await pool.end();
});

test('M11L-16 public intake preserved', async () => {
  const email = `m11l-intake-${randomUUID()}@example.com`;
  const pool = new pg.Pool({ connectionString: roleUrl(LOGIN.intake), max: 1 });
  const res = await acceptBusinessLeadAtomic(pool, {
    email,
    idempotencyKey: randomUUID(),
  });
  assert.equal(res.ok, true);
  await pool.end();
});

test('M11L-17/18 anon and authenticated denied on protected tables', async () => {
  for (const apiRole of ['anon', 'authenticated']) {
    const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [apiRole]);
    if (!exists.rowCount) continue;
    await asRole(apiRole, async (c) => {
      await assert.rejects(
        () => c.query(`SELECT 1 FROM ops.operator_commands LIMIT 1`),
        /permission denied|row-level security/,
      );
    });
  }
});

test('M11L-20 no permissive OR bypass on control_audit insert', async () => {
  const { rows } = await admin.query(
    `SELECT policyname, cmd, roles::text, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'security' AND tablename = 'control_audit' AND cmd IN ('INSERT', 'ALL')`,
  );
  const permissiveInserts = rows.filter(
    (r) =>
      r.policyname.startsWith('dth_m11l_') ||
      (r.with_check === 'true' && !r.policyname.includes('m11l')),
  );
  assert.ok(rows.some((r) => r.policyname === 'dth_m11l_ops_control_audit_insert'));
  assert.equal(
    permissiveInserts.filter((r) => r.with_check === 'true' && r.policyname !== 'dth_m11l_ops_control_audit_insert').length,
    0,
  );
});

test('M11L-21/22 no JWT or role-label authority in policies', async () => {
  const { rows } = await admin.query(
    `SELECT schemaname, tablename, policyname, qual, with_check
     FROM pg_policies
     WHERE schemaname IN ('security', 'ops', 'public')
       AND (qual ILIKE '%jwt%' OR with_check ILIKE '%jwt%'
         OR qual ILIKE '%OWNER%' OR with_check ILIKE '%OWNER%'
         OR qual ILIKE '%current_role%' OR with_check ILIKE '%current_role%')`,
  );
  assert.equal(rows.length, 0);
});

test('M11L-25 M11K pool isolation regression', async () => {
  const auth = await ownerAuth();
  const leakPool = new pg.Pool({ connectionString: DB_URL, max: 1 });
  await withAuthorizedOperatorTransaction(
    leakPool,
    { authzEvidence: auth, requestId: 'm11l-pool' },
    async (client) => {
      const live = await readCurrentOperatorRequestContext(client);
      assert.equal(live.ok, true);
    },
  );
  const client = await leakPool.connect();
  try {
    const after = await readCurrentOperatorRequestContext(client);
    assert.equal(after.code, OperatorDbContextCode.NO_CONTEXT);
  } finally {
    client.release();
    await leakPool.end();
  }
});

test('M11L-26 policy manifest complete for protected set', async () => {
  for (const { schema, table } of PROTECTED_TABLES) {
    const { rows } = await admin.query(
      `SELECT COUNT(*)::int AS n FROM pg_policies WHERE schemaname = $1 AND tablename = $2`,
      [schema, table],
    );
    assert.ok(rows[0].n >= 1, `${schema}.${table} has policies`);
  }
});

test('M11L-53 context forgery: dth_ops_api can set_config directly', async () => {
  const auth = await ownerAuth();
  let forged = false;
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('dth.operator_id', $1, true)`, [auth.operatorId]);
    await c.query(`SELECT set_config('dth.authority_version', $1, true)`, [
      String(auth.authorityVersion),
    ]);
    await c.query(`SELECT set_config('dth.required_capability', $1, true)`, [
      auth.requiredCapability,
    ]);
    const res = await c.query(
      `INSERT INTO ops.operator_commands
        (command_type, idempotency_key, operator_person_id, operator_role,
         operator_id, authority_version, required_capability, payload_hash)
       VALUES ('GLOBAL_KILL',$1,'TEST_OWNER','OWNER',$2,$3,$4,'forge') RETURNING id`,
      [`m11l-forge-${randomUUID()}`, auth.operatorId, auth.authorityVersion, auth.requiredCapability],
    );
    forged = res.rowCount === 1;
    await c.query('ROLLBACK');
  });
  assert.equal(forged, true, 'documented: compromised ops process can forge context');
});

test('M11L teardown', async () => {
  await admin.end();
});
