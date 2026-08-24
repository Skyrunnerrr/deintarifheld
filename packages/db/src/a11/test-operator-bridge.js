/**
 * E2 TEST_* → stable operator_id bridge for M11H/I/J local proof only.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TEST_OPERATOR_IDENTITIES, TEST_OPERATOR_STABLE_IDS } from '@deintarifheld/shared';

const MIGRATIONS = [
  '20260822140000_m11h_operator_identity_mapping.sql',
  '20260822150000_m11i_operator_role_capability_mapping.sql',
  '20260822160000_m11j_operator_command_authz.sql',
];

export function resolveTestOperatorIdFromPersonId(personId) {
  for (const [label, spec] of Object.entries(TEST_OPERATOR_IDENTITIES)) {
    if (spec.personId === personId) {
      return TEST_OPERATOR_STABLE_IDS[label];
    }
  }
  return null;
}

async function nextAuthorityVersion(pool, operatorId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(authority_version), 0) + 1 AS v
     FROM security.operator_role_assignments WHERE operator_id = $1::uuid`,
    [operatorId],
  );
  return Number(rows[0].v);
}

export async function ensureM11AuthoritySchema(pool) {
  const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
  const { rows } = await pool.query(
    `SELECT to_regclass('security.operator_role_assignments') AS c`,
  );
  if (!rows[0]?.c) {
    for (const file of MIGRATIONS.slice(0, 2)) {
      await pool.query(readFileSync(join(migDir, file), 'utf8'));
    }
  }
  const { rows: col } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'ops' AND table_name = 'operator_commands' AND column_name = 'operator_id'`,
  );
  if (!col.length) {
    await pool.query(readFileSync(join(migDir, MIGRATIONS[2]), 'utf8'));
  }
}

/** Seed canonical M11I role assignments for deterministic TEST_* operators. */
export async function bootstrapE2TestOperatorAuthority(pool) {
  await ensureM11AuthoritySchema(pool);
  for (const [label, spec] of Object.entries(TEST_OPERATOR_IDENTITIES)) {
    const operatorId = TEST_OPERATOR_STABLE_IDS[label];
    await pool.query(
      `INSERT INTO security.operators (operator_id, display_label, status)
       VALUES ($1::uuid, $2, 'ACTIVE')
       ON CONFLICT (operator_id) DO UPDATE
         SET display_label = EXCLUDED.display_label, status = 'ACTIVE', updated_at = now()`,
      [operatorId, spec.label],
    );
    await pool.query(
      `UPDATE security.operator_role_assignments
       SET status = 'REVOKED', revoked_at = now(), updated_at = now()
       WHERE operator_id = $1::uuid AND status = 'ACTIVE'`,
      [operatorId],
    );
    const version = await nextAuthorityVersion(pool, operatorId);
    await pool.query(
      `INSERT INTO security.operator_role_assignments
         (operator_id, role_code, status, authority_version)
       VALUES ($1::uuid, $2, 'ACTIVE', $3)`,
      [operatorId, spec.role, version],
    );
  }
}
