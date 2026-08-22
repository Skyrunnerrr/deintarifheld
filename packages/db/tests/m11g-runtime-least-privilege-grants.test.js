/**
 * DTH-M11G Runtime least-privilege grants — local disposable proof.
 * Workload groups separate; dth_grp_runtime stays empty marker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  acceptBusinessLeadAtomic,
  readFreshControlSnapshot,
} from '../src/index.js';
import { KillDomain } from '@deintarifheld/shared';

const DB_URL =
  process.env.DTH_M11G_DATABASE_URL ||
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
const GROUPS = {
  runtime: 'dth_grp_runtime',
  intake: 'dth_grp_public_intake',
  worker: 'dth_grp_worker',
  ops: 'dth_grp_ops_api',
};
const LOCAL_TEST_PASSWORD = process.env.DTH_M11G_TEST_PASSWORD || 'm11g-local-only-not-for-prod';

const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
const MIGRATIONS = [
  '20260821120000_m11f_runtime_login_roles.sql',
  '20260822100000_m11g_workload_privilege_groups.sql',
  '20260822110000_m11g_runtime_least_privilege_grants.sql',
  '20260822120000_m11g_legacy_acl_and_default_privileges.sql',
  '20260822130000_m11g_intake_rls_policies.sql',
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
    const sql = readFileSync(join(migDir, f), 'utf8');
    assert.doesNotMatch(sql, /\bPASSWORD\s+'/i);
    await admin.query(sql);
  }
  for (const role of Object.values(LOGIN)) {
    await admin.query(
      `ALTER ROLE ${pg.escapeIdentifier(role)} WITH PASSWORD ${pg.escapeLiteral(LOCAL_TEST_PASSWORD)}`,
    );
  }
  await admin.query(
    `INSERT INTO security.control_state (scope, scope_key, state, updated_by)
     VALUES ('GLOBAL', 'AUTOMATION', 'INACTIVE', 'M11G_TEST')
     ON CONFLICT (scope, scope_key) DO UPDATE SET state = EXCLUDED.state`,
  );
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

async function membersOf(rolname) {
  const { rows } = await admin.query(
    `SELECT g.rolname AS member_of
     FROM pg_auth_members m
     JOIN pg_roles r ON r.oid=m.member
     JOIN pg_roles g ON g.oid=m.roleid
     WHERE r.rolname=$1 ORDER BY 1`,
    [rolname],
  );
  return rows.map((r) => r.member_of);
}

async function hasPriv(role, obj, priv) {
  const { rows } = await admin.query(`SELECT has_table_privilege($1,$2,$3) AS ok`, [role, obj, priv]);
  return rows[0].ok;
}

test('M11G-00 apply M11F+M11G migrations', async () => {
  await applyMigrations();
});

test('M11G-01/02 membership graph + dth_grp_runtime empty', async () => {
  const sort = (a) => [...a].sort();
  assert.deepEqual(sort(await membersOf(LOGIN.intake)), sort([GROUPS.runtime, GROUPS.intake]));
  assert.deepEqual(sort(await membersOf(LOGIN.worker)), sort([GROUPS.runtime, GROUPS.worker]));
  assert.deepEqual(sort(await membersOf(LOGIN.ops)), sort([GROUPS.runtime, GROUPS.ops]));

  for (const g of [GROUPS.intake, GROUPS.worker, GROUPS.ops]) {
    assert.equal(await hasPriv(g, 'ops.offers', 'SELECT'), g === GROUPS.worker || g === GROUPS.ops);
    assert.equal(await hasPriv(g, 'ops.offers', 'SELECT'), g !== GROUPS.intake);
  }
  assert.equal(await hasPriv(GROUPS.runtime, 'ops.offers', 'SELECT'), false);
  assert.equal(await hasPriv(GROUPS.runtime, 'public.leads', 'SELECT'), false);
});

test('M11G-03 no cross-workload collapse via shared group', async () => {
  assert.equal(await hasPriv(LOGIN.intake, 'workflow.jobs', 'SELECT'), false);
  assert.equal(await hasPriv(LOGIN.worker, 'ops.operator_commands', 'SELECT'), false);
  assert.equal(await hasPriv(LOGIN.intake, 'security.control_state', 'SELECT'), false);
  assert.equal(await hasPriv(LOGIN.worker, 'security.control_state', 'INSERT'), false);
  assert.equal(await hasPriv(LOGIN.ops, 'public.leads', 'INSERT'), false);
});

test('M11G-04/27 public intake positive contract', async () => {
  const pool = rolePool(LOGIN.intake);
  const key = `m11g-${randomUUID()}`;
  const email = `m11g-intake-${randomUUID()}@example.test`;
  const res = await acceptBusinessLeadAtomic(pool, {
    email,
    idempotencyKey: key,
    pageSource: 'unternehmen',
    payload: { m11g: true },
  });
  assert.equal(res.ok, true);
  assert.equal(res.duplicate, false);
  const dup = await acceptBusinessLeadAtomic(pool, { email, idempotencyKey: key });
  assert.equal(dup.duplicate, true);
  await pool.end();
});

test('M11G-05/28 worker positive control read', async () => {
  const pool = rolePool(LOGIN.worker);
  const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
  assert.ok(typeof snap.mayClaim === 'boolean');
  await pool.end();
});

test('M11G-06/29 ops_api positive read + bounded control audit insert', async () => {
  const pool = rolePool(LOGIN.ops);
  const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
  assert.ok(snap);
  await asRole(LOGIN.ops, async (c) => {
    await c.query('BEGIN');
    await c.query(
      `INSERT INTO security.control_audit
        (scope, scope_key, to_state, control_version, reason, actor)
       VALUES ('GLOBAL','AUTOMATION','ACTIVE',1,'m11g-test','M11G_TEST')`,
    );
    await c.query('ROLLBACK');
  });
  await pool.end();
});

test('M11G-07 intake cross-workload denial', async () => {
  await asRole(LOGIN.intake, async (c) => {
    await assert.rejects(() => c.query('SELECT 1 FROM public.cases LIMIT 1'), /permission denied/);
    await assert.rejects(() => c.query('SELECT 1 FROM ops.offers LIMIT 1'), /permission denied/);
    await assert.rejects(() => c.query('SELECT 1 FROM workflow.jobs LIMIT 1'), /permission denied/);
    await assert.rejects(
      () => c.query(`INSERT INTO security.control_state (scope,scope_key,state) VALUES ('GLOBAL','X','ACTIVE')`),
      /permission denied/,
    );
  });
});

test('M11G-08 worker security-admin denial', async () => {
  await asRole(LOGIN.worker, async (c) => {
    await assert.rejects(() => c.query('CREATE ROLE m11g_fail'), /permission denied|must be/);
    await assert.rejects(
      () => c.query(`INSERT INTO security.control_audit (scope,scope_key,to_state,control_version) VALUES ('G','K','ACTIVE',1)`),
      /permission denied/,
    );
    await assert.rejects(() => c.query('SELECT 1 FROM ops.operator_commands LIMIT 1'), /permission denied/);
  });
});

test('M11G-09 ops migration/admin denial', async () => {
  await asRole(LOGIN.ops, async (c) => {
    await assert.rejects(() => c.query('CREATE TABLE public.m11g_fail(id int)'), /permission denied/);
    await assert.rejects(() => c.query('SET ROLE dth_worker'), /permission denied|must be/);
  });
});

test('M11G-10/11 anon authenticated private denial when present', async () => {
  for (const apiRole of ['anon', 'authenticated']) {
    const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [apiRole]);
    if (!exists.rowCount) continue;
    assert.equal(await hasPriv(apiRole, 'ops.offers', 'SELECT'), false);
    assert.equal(await hasPriv(apiRole, 'public.leads', 'INSERT'), false);
  }
});

test('M11G-12/13 PUBLIC ACL + no ALL schema grants', async () => {
  assert.equal(await publicHasTablePriv('public.leads', 'INSERT'), false);
  const { rows } = await admin.query(
    `SELECT grantee, privilege_type
     FROM information_schema.role_table_grants
     WHERE table_schema='ops' AND table_name='offers'
       AND grantee IN ('dth_grp_runtime','dth_public_intake','dth_worker','dth_ops_api')
       AND privilege_type='ALL'`,
  );
  assert.equal(rows.length, 0);
});

test('M11G-18 audit append-only for worker', async () => {
  assert.equal(await hasPriv(LOGIN.worker, 'public.audit_events', 'INSERT'), true);
  assert.equal(await hasPriv(LOGIN.worker, 'public.audit_events', 'UPDATE'), false);
  assert.equal(await hasPriv(LOGIN.worker, 'public.audit_events', 'DELETE'), false);
});

test('M11G-19 control read/write separation', async () => {
  assert.equal(await hasPriv(LOGIN.worker, 'security.control_state', 'SELECT'), true);
  assert.equal(await hasPriv(LOGIN.worker, 'security.control_state', 'INSERT'), false);
  assert.equal(await hasPriv(LOGIN.ops, 'security.control_state', 'INSERT'), true);
});

test('M11G-20 no cross-runtime SET ROLE', async () => {
  await asRole(LOGIN.intake, async (c) => {
    await assert.rejects(() => c.query('SET ROLE dth_worker'), /permission denied|must be/);
  });
  await asRole(LOGIN.worker, async (c) => {
    await assert.rejects(() => c.query('SET ROLE dth_ops_api'), /permission denied|must be/);
  });
});

test('M11G-22/60 future default privilege proof', async () => {
  const tbl = `__dth_m11g_future_${Date.now()}`;
  await admin.query(`CREATE TABLE ops.${tbl} (id int PRIMARY KEY)`);
  try {
    for (const role of [GROUPS.runtime, 'anon', 'authenticated']) {
      const exists = role === GROUPS.runtime
        ? { rowCount: 1 }
        : await admin.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [role]);
      if (!exists.rowCount) continue;
      assert.equal(await hasPriv(role, `ops.${tbl}`, 'SELECT'), false, role);
      assert.equal(await hasPriv(role, `ops.${tbl}`, 'INSERT'), false, role);
    }
    assert.equal(await publicHasTablePriv(`ops.${tbl}`, 'SELECT'), false);
    assert.equal(await publicHasTablePriv(`ops.${tbl}`, 'INSERT'), false);
  } finally {
    await admin.query(`DROP TABLE IF EXISTS ops.${tbl}`);
  }
});

test('M11G-26 no runtime ownership transfer', async () => {
  const { rows } = await admin.query(
    `SELECT count(*)::int AS n FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     JOIN pg_roles r ON r.oid=c.relowner
     WHERE n.nspname IN ('ops','security','workflow')
       AND r.rolname = ANY($1::text[])`,
    [Object.values(LOGIN)],
  );
  assert.equal(rows[0].n, 0);
});

test('M11G-30 manifest files present', () => {
  const manifest = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/autonomous-os/rollout/M11G-ACCESS-MANIFEST.md');
  const body = readFileSync(manifest, 'utf8');
  assert.match(body, /dth_grp_public_intake/);
  assert.match(body, /Cross-workload collapse/);
  const m11gSql = readdirSync(migDir).filter((f) => f.includes('m11g'));
  assert.ok(m11gSql.length >= 3);
});

test('M11G teardown', async () => {
  await admin.end();
});
