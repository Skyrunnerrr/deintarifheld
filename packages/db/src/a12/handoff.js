/**
 * A13 handoff shape only — no acquisition campaign mutation.
 */
export async function buildA13ContentHandoff(pool, { publicationId } = {}) {
  if (!publicationId) return { ok: false, code: 'PUBLICATION_ID_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT p.*, r.cta, r.headline, r.content_hash, i.channel AS intent_channel,
            b.purpose, b.primary_message
     FROM ops.content_publications p
     JOIN ops.content_revisions r ON r.id = p.content_revision_id
     JOIN ops.content_publication_intents i ON i.id = p.intent_id
     JOIN ops.content_items ci ON ci.id = p.content_item_id
     JOIN ops.content_briefs b ON b.id = ci.brief_id
     WHERE p.id=$1`,
    [publicationId],
  );
  const pub = rows[0];
  if (!pub) return { ok: false, code: 'PUBLICATION_NOT_FOUND' };
  if (pub.state !== 'PUBLISHED') return { ok: false, code: 'NOT_PUBLISHED', state: pub.state };

  const { rows: metrics } = await pool.query(
    `SELECT impressions, clicks, engagement, captured_at
     FROM ops.content_metric_snapshots
     WHERE publication_id=$1
     ORDER BY captured_at DESC LIMIT 5`,
    [publicationId],
  );

  const destination = 'https://www.deintarifheld.de/unternehmen';
  const correlationId = `a12:${pub.content_item_id}:${pub.id}`;
  return {
    ok: true,
    acquisitionActionsPerformed: 0,
    handoff: {
      content_id: pub.content_item_id,
      publication_id: pub.id,
      revision_id: pub.content_revision_id,
      channel: pub.channel,
      published_at: pub.published_at,
      cta: pub.cta,
      destination,
      tracking_correlation_id: correlationId,
      content_purpose: pub.purpose,
      performance_snapshots: metrics,
      provider_post_id: pub.provider_post_id,
    },
  };
}
