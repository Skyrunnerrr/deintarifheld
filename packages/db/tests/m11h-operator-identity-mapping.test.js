/**
 * DTH-M11H Operator identity mapping — local disposable proof.
 * Maps verified Supabase Auth subject → stable operator_id only (no roles).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  resolveOperatorByVerifiedAuthSubject,
  rejectClientOperatorIdentity,
  rejectMetadataOperatorAuthority,
  OperatorIdentityResolutionCode,
  resolveOperatorIdentity,
} from '../src/index.js';

const DB_URL =
  process.env.DTH_M11H_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const LOGIN = { intake: 'dth_public_intake', worker: 'dth_worker', ops: 'dth_ops_api' };
const LOCAL_TEST_PASSWORD = process.env.DTH_M11H_TEST_PASSWORD || 'm11h-local-only-not-for-prod';
const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
const M11H_MIGRATION = '20260822140000_m11h_operator_identity_mapping.sql';

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

async function applyM11hMigration() {
  const sql = readFileSync(join(migDir, M11H_MIGRATION), 'utf8');
  assert.doesNotMatch(sql, /\bPASSWORD\s+'/i);
  await admin.query(sql);
  for (const role of Object.values(LOGIN)) {
    await admin.query(
      `ALTER ROLE ${pg.escapeIdentifier(role)} WITH PASSWORD ${pg.escapeLiteral(LOCAL_TEST_PASSWORD)}`,
    );
  }
}

async function seedActiveOperator({ label = 'M11H Test Operator', email = 'm11h@test.example' } = {}) {
  const authUserId = randomUUID();
  const { rows } = await admin.query(
    `WITH op AS (
       INSERT INTO security.operators (display_label, email, status)
       VALUES ($1, $2, 'ACTIVE')
       RETURNING operator_id
     )
     INSERT INTO security.operator_auth_identities (operator_id, auth_user_id, status)
     SELECT operator_id, $3::uuid, 'ACTIVE' FROM op
     RETURNING operator_id, auth_user_id`,
    [label, email, authUserId],
  );
  return { operatorId: rows[0].operator_id, authUserId: rows[0].auth_user_id };
}

async function hasTablePriv(role, table, priv) {
  const { rows } = await admin.query(`SELECT has_table_privilege($1,$2,$3) AS ok`, [role, table, priv]);
  return rows[0].ok;
}

test('M11H-00 apply migration', async () => {
  await applyM11hMigration();
});

test('M11H-01/02 schema + stable operator_id', async () => {
  const { rows } = await admin.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='security' AND table_name='operators'
     ORDER BY 1`,
  );
  const cols = rows.map((r) => r.column_name);
  assert.ok(cols.includes('operator_id'));
  assert.ok(cols.includes('status'));
});

test('M11H-03/04 active resolution', async () => {
  const seeded = await seedActiveOperator();
  const pool = rolePool(LOGIN.ops);
  const res = await resolveOperatorByVerifiedAuthSubject(pool, {
    verifiedAuthUserId: seeded.authUserId,
  });
  await pool.end();
  assert.equal(res.ok, true);
  assert.equal(res.code, OperatorIdentityResolutionCode.ACTIVE_OPERATOR);
  assert.equal(res.operatorId, seeded.operatorId);
  assert.equal(res.authority, 1);
});

test('M11H-05 not-provisioned denial', async () => {
  const pool = rolePool(LOGIN.ops);
  const res = await resolveOperatorByVerifiedAuthSubject(pool, {
    verifiedAuthUserId: randomUUID(),
  });
  await pool.end();
  assert.equal(res.ok, false);
  assert.equal(res.code, OperatorIdentityResolutionCode.NOT_PROVISIONED);
  assert.equal(res.authority, 0);
});

test('M11H-06 disabled operator denial', async () => {
  const seeded = await seedActiveOperator({ label: 'Disabled Op' });
  await admin.query(`UPDATE security.operators SET status='DISABLED', deactivated_at=now() WHERE operator_id=$1`, [
    seeded.operatorId,
  ]);
  const pool = rolePool(LOGIN.ops);
  const res = await resolveOperatorByVerifiedAuthSubject(pool, { verifiedAuthUserId: seeded.authUserId });
  await pool.end();
  assert.equal(res.ok, false);
  assert.equal(res.code, OperatorIdentityResolutionCode.DISABLED);
  assert.equal(res.authority, 0);
});

test('M11H-07 duplicate active auth subject blocked', async () => {
  const authUserId = randomUUID();
  const op1 = await admin.query(
    `INSERT INTO security.operators (display_label, status) VALUES ('op1','ACTIVE') RETURNING operator_id`,
  );
  await admin.query(
    `INSERT INTO security.operator_auth_identities (operator_id, auth_user_id, status)
     VALUES ($1, $2::uuid, 'ACTIVE')`,
    [op1.rows[0].operator_id, authUserId],
  );
  const op2 = await admin.query(
    `INSERT INTO security.operators (display_label, status) VALUES ('op2','ACTIVE') RETURNING operator_id`,
  );
  await assert.rejects(
    () =>
      admin.query(
        `INSERT INTO security.operator_auth_identities (operator_id, auth_user_id, status)
         VALUES ($1, $2::uuid, 'ACTIVE')`,
        [op2.rows[0].operator_id, authUserId],
      ),
    /unique|duplicate/i,
  );
});

test('M11H-09/10 no email or user_metadata authority', () => {
  const emailHit = rejectMetadataOperatorAuthority({
    email: 'owner@deintarifheld.test',
    userMetadata: {},
  });
  assert.equal(emailHit.ok, false);
  const metaHit = rejectMetadataOperatorAuthority({
    userMetadata: { role: 'OWNER' },
  });
  assert.equal(metaHit.ok, false);
  assert.equal(metaHit.authority, 0);
});

test('M11H-11 client operator/auth identity rejected', () => {
  const a = rejectClientOperatorIdentity({ clientOperatorId: randomUUID() });
  const b = rejectClientOperatorIdentity({ clientAuthUserId: randomUUID() });
  assert.equal(a.ok, false);
  assert.equal(b.ok, false);
  const session = resolveOperatorIdentity({ ccSession: true, personId: 'person_synth_owner_dth_local_001' });
  assert.equal(session.ok, true);
  assert.equal(session.productionIdentity, false);
});

test('M11H-12 ops_api positive read path', async () => {
  assert.equal(await hasTablePriv(LOGIN.ops, 'security.operators', 'SELECT'), true);
  assert.equal(await hasTablePriv(LOGIN.ops, 'security.operator_auth_identities', 'SELECT'), true);
});

test('M11H-13/54 ops_api identity writes denied', async () => {
  const client = new pg.Client({ connectionString: roleUrl(LOGIN.ops) });
  await client.connect();
  try {
    await assert.rejects(
      () => client.query(`INSERT INTO security.operators (display_label, status) VALUES ('x','ACTIVE')`),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO security.operator_auth_identities (operator_id, auth_user_id, status)
           VALUES ($1, $2::uuid, 'ACTIVE')`,
          [randomUUID(), randomUUID()],
        ),
      /permission denied/,
    );
  } finally {
    await client.end();
  }
});

test('M11H-14 worker read denied', async () => {
  assert.equal(await hasTablePriv(LOGIN.worker, 'security.operators', 'SELECT'), false);
  assert.equal(await hasTablePriv(LOGIN.worker, 'security.operator_auth_identities', 'SELECT'), false);
});

test('M11H-15 intake read denied', async () => {
  assert.equal(await hasTablePriv(LOGIN.intake, 'security.operators', 'SELECT'), false);
});

test('M11H-16/17 anon authenticated denied when present', async () => {
  for (const role of ['anon', 'authenticated']) {
    const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [role]);
    if (!exists.rowCount) continue;
    assert.equal(await hasTablePriv(role, 'security.operators', 'SELECT'), false);
  }
});

test('M11H-19 deactivation preserves operator record', async () => {
  const seeded = await seedActiveOperator({ label: 'Preserve Me' });
  await admin.query(`UPDATE security.operators SET status='DISABLED' WHERE operator_id=$1`, [seeded.operatorId]);
  const { rows } = await admin.query(`SELECT status FROM security.operators WHERE operator_id=$1`, [seeded.operatorId]);
  assert.equal(rows[0].status, 'DISABLED');
});

test('M11H-20 fail-closed on invalid subject and DB unavailable', async () => {
  const bad = await resolveOperatorByVerifiedAuthSubject(admin, { verifiedAuthUserId: 'not-a-uuid' });
  assert.equal(bad.code, OperatorIdentityResolutionCode.INVALID_SUBJECT);
  const dead = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:1/none' });
  const unavailable = await resolveOperatorByVerifiedAuthSubject(dead, { verifiedAuthUserId: randomUUID() });
  await dead.end().catch(() => {});
  assert.equal(unavailable.code, OperatorIdentityResolutionCode.DATA_UNAVAILABLE);
  assert.equal(unavailable.authority, 0);
});

test('M11H-22 no tokens in migration', () => {
  const sql = readFileSync(join(migDir, M11H_MIGRATION), 'utf8');
  assert.doesNotMatch(sql, /\b(jwt|refresh_token|access_token|password_hash)\b/i);
  const hits = readdirSync(migDir).filter((f) => f.includes('m11h') && /\bPASSWORD\s+'/i.test(readFileSync(join(migDir, f), 'utf8')));
  assert.deepEqual(hits, []);
});

test('M11H teardown', async () => {
  await admin.end();
});
