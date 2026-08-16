/**
 * A1 schema compatibility gate — fail closed; no in-memory / JSON queue fallback.
 */

const REQUIRED = [
  { schema: 'workflow', table: 'workflow_instances' },
  { schema: 'workflow', table: 'jobs' },
  { schema: 'workflow', table: 'job_attempts' },
  { schema: 'security', table: 'control_version' },
  { schema: 'security', table: 'control_state' },
  { schema: 'security', table: 'control_audit' },
];

export async function assertWorkflowSchemaCompatible(pool) {
  const missing = [];
  for (const { schema, table } of REQUIRED) {
    const { rows } = await pool.query(
      `SELECT to_regclass($1) AS reg`,
      [`${schema}.${table}`],
    );
    if (!rows[0]?.reg) missing.push(`${schema}.${table}`);
  }
  if (missing.length) {
    const err = new Error(`SCHEMA_INCOMPATIBLE:${missing.join(',')}`);
    err.code = 'SCHEMA_INCOMPATIBLE';
    throw err;
  }
  return { ok: true, tables: REQUIRED.map((r) => `${r.schema}.${r.table}`) };
}
