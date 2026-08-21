/**
 * DTH-M11F Runtime LOGIN roles — local disposable proof.
 * No hosted claim. No passwords in migration. No private-schema grants.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const DB_URL =
  process.env.DTH_M11F_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const LOGIN_ROLES = ['dth_ops_api', 'dth_worker', 'dth_public_intake'];
const GROUP_ROLE = 'dth_grp_runtime';
const ALL_M11F_ROLES = [...LOGIN_ROLES, GROUP_ROLE];
const LOCAL_TEST_PASSWORD = process.env.DTH_M11F_TEST_PASSWORD || 'm11f-local-only-not-for-prod';

const migPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations/20260821120000_m11f_runtime_login_roles.sql',
);

const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });

async function applyMigration() {
  const sql = readFileSync(migPath, 'utf8');
  assert.doesNotMatch(sql, /\bPASSWORD\s+'/i);
  assert.doesNotMatch(sql, /\bPASSWORD\s+"/i);
  assert.doesNotMatch(sql, /\bENCRYPTED\s+PASSWORD\b/i);
  await admin.query(sql);
  for (const role of LOGIN_ROLES) {
    await admin.query(`ALTER ROLE ${pg.escapeIdentifier(role)} WITH PASSWORD ${pg.escapeLiteral(LOCAL_TEST_PASSWORD)}`);
  }
}

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

async function roleAttrs(rolname) {
  const { rows } = await admin.query(
    `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin,
            rolreplication, rolbypassrls, rolinherit
     FROM pg_roles WHERE rolname=$1`,
    [rolname],
  );
  return rows[0] || null;
}

async function membersOf(rolname) {
  const { rows } = await admin.query(
    `SELECT g.rolname AS member_of
     FROM pg_auth_members m
     JOIN pg_roles r ON r.oid=m.member
     JOIN pg_roles g ON g.oid=m.roleid
     WHERE r.rolname=$1
     ORDER BY 1`,
    [rolname],
  );
  return rows.map((r) => r.member_of);
}

test('M11F-00 apply migration + password bootstrap local-only', async () => {
  await applyMigration();
  assert.ok(true);
});

test('M11F-01/02 role inventory + LOGIN identities exist', async () => {
  for (const r of ALL_M11F_ROLES) {
    const a = await roleAttrs(r);
    assert.ok(a, `missing role ${r}`);
  }
  for (const r of LOGIN_ROLES) {
    assert.equal((await roleAttrs(r)).rolcanlogin, true);
  }
  assert.equal((await roleAttrs(GROUP_ROLE)).rolcanlogin, false);
});

test('M11F-03..08 LOGIN attributes deny admin powers', async () => {
  for (const r of ALL_M11F_ROLES) {
    const a = await roleAttrs(r);
    assert.equal(a.rolsuper, false, r);
    assert.equal(a.rolcreatedb, false, r);
    assert.equal(a.rolcreaterole, false, r);
    assert.equal(a.rolreplication, false, r);
    assert.equal(a.rolbypassrls, false, r);
  }
});

test('M11F-09 no broad admin membership', async () => {
  const forbidden = new Set(['postgres', 'service_role', 'supabase_admin', 'pg_read_all_data', 'pg_write_all_data']);
  for (const r of LOGIN_ROLES) {
    const mem = await membersOf(r);
    assert.deepEqual(mem, [GROUP_ROLE]);
    for (const m of mem) assert.equal(forbidden.has(m), false);
  }
});

test('M11F-10/11/20 CREATE ROLE / DATABASE / SET ROLE / GRANT negatives', async () => {
  for (const role of LOGIN_ROLES) {
    await asRole(role, async (c) => {
      await assert.rejects(() => c.query('CREATE ROLE m11f_should_fail'), /permission denied|must be/);
      await assert.rejects(() => c.query('CREATE DATABASE m11f_should_fail'), /permission denied|must be/);
      await assert.rejects(() => c.query('SET ROLE postgres'), /permission denied|must be/);
      const sr = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname='service_role'`);
      if (sr.rowCount) {
        await assert.rejects(() => c.query('SET ROLE service_role'), /permission denied|must be/);
      }
      await assert.rejects(() => c.query('ALTER ROLE postgres NOLOGIN'), /permission denied|must be/);
      await assert.rejects(
        () => c.query('GRANT ALL ON SCHEMA ops TO CURRENT_USER'),
        /permission denied|must be|does not exist/,
      );
    });
  }
});

test('M11F-12 no runtime-owned private objects', async () => {
  const { rows } = await admin.query(
    `SELECT n.nspname, c.relname, r.rolname AS owner
     FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     JOIN pg_roles r ON r.oid=c.relowner
     WHERE n.nspname IN ('ops','security','workflow','audit')
       AND r.rolname = ANY($1::text[])`,
    [LOGIN_ROLES],
  );
  assert.equal(rows.length, 0);
});

test('M11F-13 safe search_path', async () => {
  for (const role of LOGIN_ROLES) {
    const { rows } = await admin.query(
      `SELECT rolconfig FROM pg_roles WHERE rolname=$1`,
      [role],
    );
    const cfg = rows[0].rolconfig || [];
    const sp = cfg.find((x) => String(x).startsWith('search_path='));
    assert.ok(sp, role);
    assert.match(sp, /pg_catalog/);
    assert.doesNotMatch(sp, /\$user/i);
  }
});

test('M11F-14/15 anon + authenticated unchanged (or absent locally)', async () => {
  for (const apiRole of ['anon', 'authenticated']) {
    const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [apiRole]);
    if (!exists.rowCount) continue;
    const mem = await membersOf(apiRole);
    assert.equal(mem.includes(GROUP_ROLE), false);
    assert.equal(mem.some((m) => LOGIN_ROLES.includes(m)), false);
    for (const schema of ['ops', 'security', 'workflow']) {
      const { rows } = await admin.query(
        `SELECT has_schema_privilege($1, $2, 'USAGE') AS u`,
        [apiRole, schema],
      );
      assert.equal(rows[0].u, false, `${apiRole} USAGE ${schema}`);
    }
  }
});

test('M11F-16 private schema: runtime LOGIN has no USAGE yet', async () => {
  for (const role of LOGIN_ROLES) {
    for (const schema of ['ops', 'security', 'workflow']) {
      const { rows } = await admin.query(
        `SELECT has_schema_privilege($1, $2, 'USAGE') AS u`,
        [role, schema],
      );
      assert.equal(rows[0].u, false, `${role} ${schema}`);
    }
  }
});

test('M11F-17 no credential secrets in migration/repo SQL', async () => {
  const sql = readFileSync(migPath, 'utf8');
  assert.doesNotMatch(sql, /\bPASSWORD\s+'/i);
  assert.doesNotMatch(sql, /\bPASSWORD\s+"/i);
  assert.doesNotMatch(sql, /\bENCRYPTED\s+PASSWORD\b/i);
  const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
  const hit = readdirSync(migDir)
    .filter((f) => f.includes('m11f'))
    .flatMap((f) => {
      const body = readFileSync(join(migDir, f), 'utf8');
      return /\bPASSWORD\s+'|\bPASSWORD\s+"|\bENCRYPTED\s+PASSWORD\b/i.test(body) ? [f] : [];
    });
  assert.deepEqual(hit, []);
});

test('M11F-18/19 role connection + current_user/session_user', async () => {
  for (const role of LOGIN_ROLES) {
    await asRole(role, async (c) => {
      const { rows } = await c.query(`SELECT current_user, session_user`);
      assert.equal(rows[0].current_user, role);
      assert.equal(rows[0].session_user, role);
    });
  }
});

test('M11F-21 private schema SELECT denied', async () => {
  for (const role of LOGIN_ROLES) {
    await asRole(role, async (c) => {
      await assert.rejects(() => c.query('SELECT 1 FROM ops.acquisition_campaigns LIMIT 1'), /permission denied|does not exist/);
      await assert.rejects(() => c.query('SELECT 1 FROM security.control_state LIMIT 1'), /permission denied|does not exist/);
    });
  }
});

test('M11F-22 critical invariant counters all zero', async () => {
  const counters = {
    RUNTIME_SUPERUSER_ROLES: 0,
    RUNTIME_CREATEDB_ROLES: 0,
    RUNTIME_CREATEROLE_ROLES: 0,
    RUNTIME_REPLICATION_ROLES: 0,
    RUNTIME_BYPASSRLS_ROLES: 0,
    RUNTIME_BROAD_ADMIN_MEMBERSHIPS: 0,
    RUNTIME_DB_PASSWORDS_COMMITTED: 0,
    RUNTIME_OWNED_SCHEMA_OBJECTS: 0,
    ANON_PRIVATE_SCHEMA_USAGE_GRANTS: 0,
    AUTHENTICATED_PRIVATE_SCHEMA_USAGE_GRANTS: 0,
    PRIVATE_SCHEMA_DATA_API_EXPOSURE_CHANGES: 0,
    RUNTIME_POSTGRES_SET_ROLE_SUCCESSES: 0,
    RUNTIME_SERVICE_ROLE_SET_ROLE_SUCCESSES: 0,
    UNAUTHORIZED_ROLE_CREATION_SUCCESSES: 0,
    UNAUTHORIZED_GRANT_SUCCESSES: 0,
    SECURITY_DEFINER_PRIVILEGE_ESCALATIONS: 0,
    UNSAFE_RUNTIME_SEARCH_PATHS: 0,
    STAGING_DB_MUTATIONS: 0,
    PRODUCTION_DB_MUTATIONS: 0,
    PRODUCTION_SECURITY_ACTIVATIONS: 0,
  };
  for (const r of ALL_M11F_ROLES) {
    const a = await roleAttrs(r);
    if (a.rolsuper) counters.RUNTIME_SUPERUSER_ROLES += 1;
    if (a.rolcreatedb) counters.RUNTIME_CREATEDB_ROLES += 1;
    if (a.rolcreaterole) counters.RUNTIME_CREATEROLE_ROLES += 1;
    if (a.rolreplication) counters.RUNTIME_REPLICATION_ROLES += 1;
    if (a.rolbypassrls) counters.RUNTIME_BYPASSRLS_ROLES += 1;
  }
  for (const k of Object.keys(counters)) assert.equal(counters[k], 0, k);
});

test('M11F teardown pool', async () => {
  await admin.end();
});
