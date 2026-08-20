/**
 * Append-only content metric snapshots. Not revenue attribution.
 */
import { createDeterministicTestPublishingProvider } from './provider.js';

export async function refreshContentMetrics(pool, {
  publicationId,
  publisher = null,
} = {}) {
  if (!publicationId) return { ok: false, code: 'PUBLICATION_ID_REQUIRED' };
  const { rows } = await pool.query(`SELECT * FROM ops.content_publications WHERE id=$1`, [publicationId]);
  const pub = rows[0];
  if (!pub) return { ok: false, code: 'PUBLICATION_NOT_FOUND' };
  if (pub.state !== 'PUBLISHED' || !pub.provider_post_id) {
    return { ok: false, code: 'NOT_PUBLISHED' };
  }
  const provider = publisher || createDeterministicTestPublishingProvider();
  const m = await provider.getMetrics({ providerPostId: pub.provider_post_id });
  if (!m.ok) return { ok: false, code: 'METRICS_READBACK_FAILED' };
  const { rows: snap } = await pool.query(
    `INSERT INTO ops.content_metric_snapshots
      (publication_id, impressions, clicks, engagement, raw_metrics)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     RETURNING *`,
    [
      publicationId,
      m.metrics.impressions || 0,
      m.metrics.clicks || 0,
      m.metrics.engagement || 0,
      JSON.stringify({ ...m.metrics, revenueAttribution: null }),
    ],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.metrics_updated',$1::jsonb)`,
    [JSON.stringify({ publication_id: publicationId, snapshot_id: snap[0].id })],
  );
  return {
    ok: true,
    snapshot: snap[0],
    revenueAttribution: null,
    providerCalls: m.providerCalls || 1,
  };
}

export async function listContentMetricSnapshots(pool, publicationId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.content_metric_snapshots WHERE publication_id=$1 ORDER BY captured_at ASC`,
    [publicationId],
  );
  return rows;
}
