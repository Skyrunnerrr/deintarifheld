/**
 * Acquisition metric snapshots. CPL only if spend+leads exact. ROAS UNKNOWN without revenue.
 */
import { createDeterministicTestAcquisitionProvider } from './provider.js';
import { bumpA13Invariant } from './invariants.js';

export function computeCplMicroEur({ spendMicroEur, leadsAccepted }) {
  const spend = BigInt(spendMicroEur || 0);
  const leads = Number(leadsAccepted || 0);
  if (spend < 0n) throw new Error('NEGATIVE_SPEND');
  if (!Number.isInteger(leads) || leads < 0) throw new Error('INVALID_LEADS');
  if (spend === 0n || leads === 0) {
    return { cplMicroEur: null, cpl: 'UNKNOWN', reason: 'SPEND_OR_LEADS_MISSING' };
  }
  return { cplMicroEur: spend / BigInt(leads), cpl: 'COMPUTED' };
}

export function computeRoas({ spendMicroEur, revenueMicroEur }) {
  if (revenueMicroEur == null || revenueMicroEur === '' || revenueMicroEur === undefined) {
    return { roas: 'UNKNOWN', reason: 'REVENUE_UNKNOWN' };
  }
  const spend = BigInt(spendMicroEur || 0);
  const revenue = BigInt(revenueMicroEur);
  if (spend <= 0n) return { roas: 'UNKNOWN', reason: 'SPEND_MISSING' };
  // Exact rational as string — no fake precision claims
  return { roas: `${revenue}/${spend}`, reason: 'EXACT_RATIO' };
}

export async function refreshAcquisitionMetrics(pool, {
  campaignId,
  provider = null,
  revenueMicroEur = null,
  forceFakeRoas = false,
  forceFakeCpl = false,
} = {}) {
  if (!campaignId) return { ok: false, code: 'CAMPAIGN_ID_REQUIRED' };
  if (forceFakeRoas) {
    bumpA13Invariant('UNSUPPORTED_ROAS_CALCULATIONS');
    return { ok: false, code: 'UNSUPPORTED_ROAS_FORBIDDEN' };
  }
  if (forceFakeCpl) {
    bumpA13Invariant('UNSUPPORTED_CPL_CALCULATIONS');
    return { ok: false, code: 'UNSUPPORTED_CPL_FORBIDDEN' };
  }

  const { rows: camps } = await pool.query(
    `SELECT * FROM ops.acquisition_campaigns WHERE id=$1`,
    [campaignId],
  );
  const camp = camps[0];
  if (!camp) return { ok: false, code: 'CAMPAIGN_NOT_FOUND' };

  const { rows: pcs } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_campaigns
     WHERE campaign_id=$1 AND provider_campaign_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [campaignId],
  );
  const pc = pcs[0];

  let impressions = 0;
  let clicks = 0;
  let spendMicro = 0n;
  let providerCalls = 0;

  if (pc?.provider_campaign_id) {
    const acqProvider = provider || createDeterministicTestAcquisitionProvider();
    const m = await acqProvider.getCampaignMetrics({ providerCampaignId: pc.provider_campaign_id });
    providerCalls = m.providerCalls || 1;
    if (m.ok) {
      impressions = m.metrics.impressions || 0;
      clicks = m.metrics.clicks || 0;
      spendMicro = BigInt(m.metrics.spendMicroEur || 0);
      if (spendMicro > BigInt(pc.spend_micro_eur || 0)) {
        await pool.query(
          `UPDATE ops.acquisition_provider_campaigns SET spend_micro_eur=$2, updated_at=now() WHERE id=$1`,
          [pc.id, String(spendMicro)],
        );
      }
    }
  }

  const { rows: visitRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ops.acquisition_touchpoints
     WHERE campaign_id=$1 AND touchpoint_type='LANDING_VISIT'`,
    [campaignId],
  );
  const { rows: formRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ops.acquisition_touchpoints
     WHERE campaign_id=$1 AND touchpoint_type='FORM_STARTED'`,
    [campaignId],
  );
  const { rows: leadRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ops.lead_attributions
     WHERE campaign_id=$1 AND attribution_state='ATTRIBUTED'`,
    [campaignId],
  );

  const leadsAccepted = leadRows[0].n;
  const cpl = computeCplMicroEur({ spendMicroEur: spendMicro, leadsAccepted });
  const roas = computeRoas({ spendMicroEur: spendMicro, revenueMicroEur });

  if (revenueMicroEur != null && roas.roas === 'UNKNOWN') {
    // still unknown — fine
  }
  if (revenueMicroEur == null && forceFakeRoas === false) {
    // ROAS stays UNKNOWN — good
  }

  const { rows: snap } = await pool.query(
    `INSERT INTO ops.acquisition_metric_snapshots
      (campaign_id, campaign_revision_id, provider_campaign_row_id,
       impressions, clicks, landing_visits, form_starts, leads_accepted,
       spend_micro_eur, cpl_micro_eur, roas, revenue_micro_eur, raw_metrics)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     RETURNING *`,
    [
      campaignId,
      camp.current_revision_id,
      pc?.id || null,
      impressions,
      clicks,
      visitRows[0].n,
      formRows[0].n,
      leadsAccepted,
      String(spendMicro),
      cpl.cplMicroEur != null ? String(cpl.cplMicroEur) : null,
      roas.roas,
      revenueMicroEur != null ? String(revenueMicroEur) : null,
      JSON.stringify({
        cplStatus: cpl.cpl,
        roasStatus: roas.roas === 'UNKNOWN' ? 'UNKNOWN' : 'COMPUTED',
        revenueAttribution: revenueMicroEur != null ? 'PROVIDED' : null,
      }),
    ],
  );

  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.metrics_updated',$1::jsonb)`,
    [JSON.stringify({ campaign_id: campaignId, snapshot_id: snap[0].id, roas: roas.roas })],
  );

  return {
    ok: true,
    snapshot: snap[0],
    cpl: cpl.cpl,
    cplMicroEur: cpl.cplMicroEur != null ? String(cpl.cplMicroEur) : null,
    roas: roas.roas,
    revenue: revenueMicroEur != null ? String(revenueMicroEur) : 'UNKNOWN',
    providerCalls,
  };
}

export async function listAcquisitionMetricSnapshots(pool, campaignId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.acquisition_metric_snapshots WHERE campaign_id=$1 ORDER BY captured_at ASC`,
    [campaignId],
  );
  return rows;
}
