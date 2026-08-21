/**
 * Wipe A12 content tables (FK-safe). Prefer TRUNCATE CASCADE for harness isolation.
 */
export async function wipeContentDomain(pool) {
  const { rows } = await pool.query(`SELECT to_regclass('ops.content_briefs') AS c`);
  if (!rows[0]?.c) return { wiped: false };

  await pool.query(`
    TRUNCATE TABLE
      ops.content_metric_snapshots,
      ops.content_publications,
      ops.content_publication_intents,
      ops.content_approvals,
      ops.content_claims,
      ops.content_revisions,
      ops.content_items,
      ops.content_briefs
    RESTART IDENTITY CASCADE
  `);
  return { wiped: true };
}
