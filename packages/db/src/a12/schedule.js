/**
 * Durable content publication schedule (intent state SCHEDULED).
 */
import { ContentStatus, ContentApprovalDecision, A12_TEST_PUBLISHER_ID } from '@deintarifheld/shared';
import { contentControlGate } from './policy.js';

export async function scheduleContentPublication(pool, {
  revisionId,
  scheduledAt = new Date(),
  providerCode = A12_TEST_PUBLISHER_ID,
} = {}) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const gate = await contentControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };

  const { rows } = await pool.query(`SELECT * FROM ops.content_revisions WHERE id=$1`, [revisionId]);
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, code: 'STALE_CONTENT_REVISION' };

  const { rows: items } = await pool.query(`SELECT * FROM ops.content_items WHERE id=$1`, [rev.content_item_id]);
  const item = items[0];
  if (!item) return { ok: false, code: 'ITEM_NOT_FOUND' };
  if ([ContentStatus.BLOCKED, ContentStatus.CANCELLED, ContentStatus.PUBLISHED].includes(item.status)) {
    return { ok: false, code: 'ITEM_NOT_SCHEDULABLE', status: item.status };
  }

  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.content_approvals WHERE content_revision_id=$1`,
    [revisionId],
  );
  if (!appr[0] || appr[0].decision !== ContentApprovalDecision.APPROVED) {
    return { ok: false, code: 'APPROVAL_MISSING' };
  }
  if (appr[0].content_hash !== rev.content_hash) {
    return { ok: false, code: 'STALE_CONTENT_APPROVAL' };
  }

  const idempotencyKey = `content-pub:${revisionId}:${rev.content_hash}`;
  const { rows: intentRows } = await pool.query(
    `INSERT INTO ops.content_publication_intents
      (content_revision_id, content_item_id, channel, content_hash, provider_code,
       idempotency_key, state, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,'SCHEDULED',$7)
     ON CONFLICT (idempotency_key) DO UPDATE SET updated_at=now()
     RETURNING *`,
    [
      revisionId, item.id, item.channel, rev.content_hash, providerCode,
      idempotencyKey, scheduledAt,
    ],
  );
  const intent = intentRows[0];
  await pool.query(
    `UPDATE ops.content_items SET status=$2, updated_at=now() WHERE id=$1 AND status NOT IN ('PUBLISHED','CANCELLED')`,
    [item.id, ContentStatus.SCHEDULED],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.scheduled',$1::jsonb)`,
    [JSON.stringify({ intent_id: intent.id, revision_id: revisionId, scheduled_at: scheduledAt })],
  );
  return { ok: true, intentId: intent.id, idempotencyKey, intent };
}

export async function listDueContentPublicationIntents(pool, { now = new Date(), limit = 50 } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.content_publication_intents
     WHERE state='SCHEDULED' AND scheduled_at <= $1
     ORDER BY scheduled_at ASC
     LIMIT $2`,
    [now, limit],
  );
  return rows;
}
