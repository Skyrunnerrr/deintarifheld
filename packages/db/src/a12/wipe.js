/**
 * Wipe A12 content tables (FK-safe order).
 */
export async function wipeContentDomain(pool) {
  const { rows } = await pool.query(`SELECT to_regclass('ops.content_briefs') AS c`);
  if (!rows[0]?.c) return { wiped: false };
  await pool.query(`DELETE FROM ops.content_metric_snapshots`);
  await pool.query(`DELETE FROM ops.content_publications`);
  await pool.query(`DELETE FROM ops.content_publication_intents`);
  await pool.query(`DELETE FROM ops.content_approvals`);
  await pool.query(`DELETE FROM ops.content_claims`);
  await pool.query(`UPDATE ops.content_items SET current_revision_id=NULL`);
  await pool.query(`DELETE FROM ops.content_revisions`);
  await pool.query(`DELETE FROM ops.content_items`);
  await pool.query(`DELETE FROM ops.content_briefs`);
  return { wiped: true };
}
