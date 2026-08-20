/**
 * Wipe A13 acquisition tables (FK-safe order).
 */
export async function wipeAcquisitionDomain(pool) {
  const { rows } = await pool.query(`SELECT to_regclass('ops.acquisition_campaigns') AS c`);
  if (!rows[0]?.c) return { wiped: false };
  await pool.query(`DELETE FROM ops.acquisition_metric_snapshots`);
  await pool.query(`DELETE FROM ops.acquisition_provider_campaigns`);
  await pool.query(`DELETE FROM ops.acquisition_provider_intents`);
  await pool.query(`DELETE FROM ops.campaign_approvals`);
  await pool.query(`DELETE FROM ops.lead_attributions`);
  await pool.query(`DELETE FROM ops.acquisition_touchpoints`);
  await pool.query(`DELETE FROM ops.acquisition_refs`);
  await pool.query(`UPDATE ops.acquisition_campaigns SET current_revision_id=NULL`);
  await pool.query(`DELETE FROM ops.acquisition_campaign_revisions`);
  await pool.query(`DELETE FROM ops.acquisition_campaigns`);
  return { wiped: true };
}
