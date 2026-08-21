/**
 * Wipe A13 acquisition tables (FK-safe). Prefer TRUNCATE CASCADE for harness isolation.
 */
export async function wipeAcquisitionDomain(pool) {
  const { rows } = await pool.query(`SELECT to_regclass('ops.acquisition_campaigns') AS c`);
  if (!rows[0]?.c) return { wiped: false };

  // Single statement — avoids mid-wipe FK races under concurrent harness pollution.
  await pool.query(`
    TRUNCATE TABLE
      ops.acquisition_metric_snapshots,
      ops.acquisition_provider_campaigns,
      ops.acquisition_provider_intents,
      ops.campaign_approvals,
      ops.lead_attributions,
      ops.acquisition_touchpoints,
      ops.acquisition_refs,
      ops.acquisition_campaign_revisions,
      ops.acquisition_campaigns
    RESTART IDENTITY CASCADE
  `);
  return { wiped: true };
}
