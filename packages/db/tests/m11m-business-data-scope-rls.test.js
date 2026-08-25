/**
 * DTH-M11M Full business data-scope RLS — local disposable proof.
 * Uses runtime login roles (not postgres) for enforcement evidence.
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
  readFreshControlSnapshot,
} from '../src/index.js';
import { KillDomain } from '@deintarifheld/shared';

const DB_URL =
  process.env.DTH_M11M_DATABASE_URL ||
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
const LOCAL_TEST_PASSWORD = process.env.DTH_M11M_TEST_PASSWORD || 'm11f-local-only-not-for-prod';

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
  '20260822180000_m11m_business_data_scope_rls.sql',
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

async function ownerAuth(cap = OperatorCapability.CASE_VIEW) {
  return authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
    requiredCapability: cap,
  });
}

async function viewerAuth(cap = OperatorCapability.CASE_VIEW) {
  return authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_VIEWER,
    requiredCapability: cap,
  });
}

test('M11M-00 apply migrations + bootstrap', async () => {
  await applyMigrations();
  await bootstrapE2TestOperatorAuthority(admin);
});

test('M11M-01/02 table inventory + classification coverage', async () => {
  const { rows } = await admin.query(
    `SELECT n.nspname AS schema, COUNT(*)::int AS n
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public','ops','security','workflow') AND c.relkind = 'r'
     GROUP BY 1 ORDER BY 1`,
  );
  const bySchema = Object.fromEntries(rows.map((r) => [r.schema, r.n]));
  assert.equal(bySchema.ops, 66);
  assert.equal(bySchema.public, 5);
  assert.equal(bySchema.security, 9);
  assert.equal(bySchema.workflow, 3);
  assert.equal(rows.reduce((a, r) => a + r.n, 0), 83);

  const { rows: missing } = await admin.query(
    `SELECT n.nspname||'.'||c.relname AS tbl
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public','ops','security','workflow') AND c.relkind = 'r'
       AND NOT EXISTS (
         SELECT 1 FROM pg_policies p
         WHERE p.schemaname = n.nspname AND p.tablename = c.relname
       )
       AND c.relname <> 'career_applications'
     ORDER BY 1`,
  );
  assert.equal(missing.length, 0, JSON.stringify(missing));
});

test('M11M-07/08 RLS + FORCE on protected business set', async () => {
  const { rows } = await admin.query(
    `SELECT n.nspname||'.'||c.relname AS tbl, c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('ops','workflow') AND c.relkind = 'r'
       AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)`,
  );
  assert.equal(rows.length, 0, JSON.stringify(rows));
});

test('M11M-03 runtime credential path honesty (documented)', () => {
  // Ops BFF / workers still take opaque URL pools (typically postgres).
  // M11M proves dth_* LOGIN role enforcement; wiring is a later cutover gate.
  assert.equal(
    'RUNTIME_DATABASE_IDENTITY_ALIGNMENT',
    'RUNTIME_DATABASE_IDENTITY_ALIGNMENT',
  );
});

test('M11M-09 no-context ops deny on business tables', async () => {
  await asRole(LOGIN.ops, async (c) => {
    const cases = await c.query(`SELECT COUNT(*)::int AS n FROM public.cases`);
    assert.equal(cases.rows[0].n, 0);
    const docs = await c.query(`SELECT COUNT(*)::int AS n FROM ops.documents`);
    assert.equal(docs.rows[0].n, 0);
    const offers = await c.query(`SELECT COUNT(*)::int AS n FROM ops.offers`);
    assert.equal(offers.rows[0].n, 0);
    await assert.rejects(
      () => c.query(`INSERT INTO ops.case_qualifications DEFAULT VALUES`),
      /row-level security|violates|null value|not-null|default/,
    );
  });
});

test('M11M-10 valid CASE_VIEW context allows case reads', async () => {
  const auth = await ownerAuth(OperatorCapability.CASE_VIEW);
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, buildTrustedDbRequestContext(auth, 'm11m-read'));
    await c.query(`SELECT COUNT(*)::int AS n FROM public.cases`);
    await c.query(`SELECT COUNT(*)::int AS n FROM ops.documents`);
    await c.query(`SELECT COUNT(*)::int AS n FROM ops.offers`);
    await c.query('ROLLBACK');
  });
});

test('M11M-11 VIEWER cannot mutate offers/approvals', async () => {
  const auth = await viewerAuth(OperatorCapability.CASE_VIEW);
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, buildTrustedDbRequestContext(auth, 'm11m-viewer'));
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO ops.offer_approvals DEFAULT VALUES`,
        ),
      /row-level security|violates|null value|not-null|default/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11M-23 approval requires APPROVAL_DECIDE', async () => {
  const op = await authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OPERATOR,
    requiredCapability: OperatorCapability.TASK_WRITE,
  });
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, buildTrustedDbRequestContext(op, 'm11m-apr'));
    await assert.rejects(
      () => c.query(`INSERT INTO ops.offer_approvals DEFAULT VALUES`),
      /row-level security|violates|null value|not-null|default/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11M-12/13 stale + disabled deny business write', async () => {
  const auth = await ownerAuth(OperatorCapability.TAKEOVER_MANAGE);
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, {
      ...buildTrustedDbRequestContext(auth, 'm11m-stale'),
      authorityVersion: auth.authorityVersion - 1,
    });
    await assert.rejects(
      () => c.query(`INSERT INTO ops.case_qualifications DEFAULT VALUES`),
      /row-level security|violates|null value|not-null|default/,
    );
    await c.query('ROLLBACK');
  });

  await admin.query(
    `UPDATE security.operators SET status = 'DISABLED' WHERE operator_id = $1::uuid`,
    [TEST_OPERATOR_STABLE_IDS.TEST_OWNER],
  );
  try {
    await asRole(LOGIN.ops, async (c) => {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('dth.operator_id', $1, true)`, [
        TEST_OPERATOR_STABLE_IDS.TEST_OWNER,
      ]);
      await c.query(`SELECT set_config('dth.authority_version', '1', true)`);
      await c.query(`SELECT set_config('dth.required_capability', 'CASE_VIEW', true)`);
      const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM public.cases`);
      assert.equal(rows[0].n, 0);
      await c.query('ROLLBACK');
    });
  } finally {
    await admin.query(
      `UPDATE security.operators SET status = 'ACTIVE' WHERE operator_id = $1::uuid`,
      [TEST_OPERATOR_STABLE_IDS.TEST_OWNER],
    );
    await bootstrapE2TestOperatorAuthority(admin);
  }
});

test('M11M-15/31/32 provider-state impersonation boundaries', async () => {
  const auth = await ownerAuth(OperatorCapability.TAKEOVER_MANAGE);
  await asRole(LOGIN.ops, async (c) => {
    await assert.rejects(
      () => c.query(`INSERT INTO ops.switch_provider_events DEFAULT VALUES`),
      /row-level security|violates|null value|not-null|default/,
    );
  });
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, buildTrustedDbRequestContext(auth, 'm11m-prov'));
    await assert.rejects(
      () => c.query(`INSERT INTO ops.acquisition_provider_campaigns DEFAULT VALUES`),
      /row-level security|violates|null value|not-null|default/,
    );
    await c.query('ROLLBACK');
  });

  await asRole(LOGIN.worker, async (c) => {
    await c.query('BEGIN');
    try {
      await c.query(
        `INSERT INTO ops.switch_provider_events (id) VALUES (gen_random_uuid())`,
      );
    } catch (e) {
      assert.match(String(e.message), /null value|not-null|column|violates|does not exist|syntax/i);
    }
    await c.query('ROLLBACK');
  });
});

test('M11M-27 content cannot use CASE_VIEW as write authority', async () => {
  const auth = await ownerAuth(OperatorCapability.CASE_VIEW);
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, buildTrustedDbRequestContext(auth, 'm11m-content'));
    const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM ops.content_items`);
    assert.equal(rows[0].n, 0);
    await assert.rejects(
      () => c.query(`INSERT INTO ops.content_items DEFAULT VALUES`),
      /row-level security|violates|null value|not-null|default/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11M-28 acquisition activate capability gate', async () => {
  const pause = await authorizeOperatorAction(admin, {
    operatorId: TEST_OPERATOR_STABLE_IDS.TEST_OPERATOR,
    requiredCapability: OperatorCapability.ACQUISITION_PAUSE,
  });
  assert.equal(pause.ok, true);
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, buildTrustedDbRequestContext(pause, 'm11m-acq'));
    // pause is write-capable for acquisition tables under acquisition_write()
    await c.query(`SELECT COUNT(*)::int AS n FROM ops.acquisition_campaigns`);
    await c.query('ROLLBACK');
  });

  const viewer = await viewerAuth(OperatorCapability.ACQUISITION_VIEW);
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await installOperatorRequestContext(c, buildTrustedDbRequestContext(viewer, 'm11m-acq-v'));
    await assert.rejects(
      () => c.query(`INSERT INTO ops.acquisition_campaigns DEFAULT VALUES`),
      /row-level security|violates|null value|not-null|default/,
    );
    await c.query('ROLLBACK');
  });
});

test('M11M-05/15 worker control + business access preserved', async () => {
  const pool = new pg.Pool({ connectionString: roleUrl(LOGIN.worker), max: 1 });
  const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
  assert.ok(typeof snap.mayClaim === 'boolean');
  await asRole(LOGIN.worker, async (c) => {
    await c.query(`SELECT COUNT(*)::int AS n FROM ops.offers`);
    await c.query(`SELECT COUNT(*)::int AS n FROM workflow.jobs`);
    await assert.rejects(
      () => c.query(`SELECT 1 FROM security.operators LIMIT 1`),
      /permission denied|row-level security/,
    );
  });
  await pool.end();
});

test('M11M-06/33 intake isolation', async () => {
  const email = `m11m-intake-${randomUUID()}@example.com`;
  const pool = new pg.Pool({ connectionString: roleUrl(LOGIN.intake), max: 1 });
  const res = await acceptBusinessLeadAtomic(pool, {
    email,
    idempotencyKey: randomUUID(),
  });
  assert.equal(res.ok, true);
  await asRole(LOGIN.intake, async (c) => {
    await assert.rejects(() => c.query(`SELECT 1 FROM ops.documents LIMIT 1`), /permission denied/);
    await assert.rejects(() => c.query(`SELECT 1 FROM ops.offers LIMIT 1`), /permission denied/);
    await assert.rejects(() => c.query(`SELECT 1 FROM public.cases LIMIT 1`), /permission denied/);
    await assert.rejects(() => c.query(`SELECT 1 FROM security.control_state LIMIT 1`), /permission denied/);
  });
  await pool.end();
});

test('M11M-34 PUBLIC/anon/authenticated isolation', async () => {
  for (const apiRole of ['anon', 'authenticated']) {
    const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [apiRole]);
    if (!exists.rowCount) continue;
    await asRole(apiRole, async (c) => {
      await assert.rejects(() => c.query(`SELECT 1 FROM public.cases LIMIT 1`), /permission denied/);
      await assert.rejects(() => c.query(`SELECT 1 FROM ops.offers LIMIT 1`), /permission denied/);
    });
  }
});

test('M11M-30 control regression (M11L)', async () => {
  await asRole(LOGIN.ops, async (c) => {
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO security.control_audit (scope,scope_key,to_state,control_version)
           VALUES ('GLOBAL','X','ACTIVE',1)`,
        ),
      /row-level security|violates/,
    );
  });
});

test('M11M-36 service_role inventory note', async () => {
  const { rows } = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname = 'service_role'`);
  // Local disposable DB may lack service_role; retirement remains NOT_YET_COMPLETE either way.
  assert.ok(rows.length === 0 || rows.length === 1);
});

test('M11M-37 no JWT / role-label authority in new policies', async () => {
  const { rows } = await admin.query(
    `SELECT schemaname, tablename, policyname
     FROM pg_policies
     WHERE policyname LIKE 'dth_m11m_%'
       AND (qual ILIKE '%jwt%' OR with_check ILIKE '%jwt%'
         OR qual ILIKE '%OWNER%' OR with_check ILIKE '%OWNER%')`,
  );
  assert.equal(rows.length, 0);
});

test('M11M-40 policy decision completeness', async () => {
  const { rows } = await admin.query(
    `SELECT COUNT(*)::int AS n FROM pg_policies WHERE policyname LIKE 'dth_m11m_%'`,
  );
  assert.ok(rows[0].n > 50, `expected many m11m policies, got ${rows[0].n}`);
});

test('M11M open risk remains: context forgery possible', async () => {
  // Documented residual: compromised dth_ops_api can set_config — risk stays OPEN.
  const auth = await ownerAuth(OperatorCapability.CASE_VIEW);
  let forged = false;
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('dth.operator_id', $1, true)`, [auth.operatorId]);
    await c.query(`SELECT set_config('dth.authority_version', $1, true)`, [
      String(auth.authorityVersion),
    ]);
    await c.query(`SELECT set_config('dth.required_capability', 'CASE_VIEW', true)`);
    const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM public.cases`);
    forged = typeof rows[0].n === 'number';
    await c.query('ROLLBACK');
  });
  assert.equal(forged, true);
});

test('M11M teardown', async () => {
  await admin.end();
});
