/**
 * A8 send-gate — SQL + A7 freshness only. No A4 import (avoids cycles).
 */
import { isTariffEvaluationCurrent } from '../a7/handoff.js';
import { OfferState } from '@deintarifheld/shared';
import { OFFER_FOLLOWUP_DUE_CAPABILITY } from '@deintarifheld/shared';
import { createFollowOnJob } from '../workflow/instances.js';
import { hasTakeover, loadWorkflow } from './prepare.js';

const TERMINAL = new Set([
  OfferState.EXPIRED,
  OfferState.SUPERSEDED,
  OfferState.CANCELLED,
  OfferState.INVALIDATED,
  OfferState.ACCEPTED,
  OfferState.REJECTED,
]);

export async function loadRevisionForIntent(pool, intent) {
  const { rows } = await pool.query(
    `SELECT r.*, o.case_id, o.id AS offer_id, o.status AS offer_status
     FROM ops.offer_revisions r
     JOIN ops.offers o ON o.id = r.offer_id
     WHERE o.case_id = $2
       AND (r.delivery_intent_id = $1 OR r.is_current = true)
     ORDER BY CASE WHEN r.delivery_intent_id = $1 THEN 0 ELSE 1 END, r.created_at DESC
     LIMIT 1`,
    [intent.id, intent.case_id],
  );
  return rows[0] || null;
}

/**
 * Pre-send / follow-up checks for an A4 offer intent.
 */
export async function assertOfferIntentSendable(pool, intent) {
  const reasons = [];
  const rev = await loadRevisionForIntent(pool, intent);
  if (!rev) {
    return { ok: false, reasons: ['OFFER_REVISION_MISSING'] };
  }
  if (rev.customer_deliverable_live === true || rev.synthetic !== true) {
    reasons.push('SYNTHETIC_LIVE_BLOCK');
  }
  if (rev.source_kind !== 'TEST_FIXTURE') {
    reasons.push('SOURCE_NOT_TEST_FIXTURE');
  }
  if (TERMINAL.has(rev.state)) {
    reasons.push(`OFFER_${rev.state}`);
  }
  if (intent.purpose === 'OFFER_DELIVERY') {
    if (rev.state === 'SENT') reasons.push('ALREADY_SENT');
    else if (!['READY', 'APPROVED'].includes(rev.state)) reasons.push('OFFER_NOT_READY');
  }
  if (intent.purpose === 'OFFER_FOLLOWUP') {
    if (rev.state !== 'SENT') reasons.push('OFFER_NOT_SENT');
  }
  if (!rev.is_current) reasons.push('REVISION_NOT_CURRENT');

  const { rows: nowRows } = await pool.query(`SELECT now() AS n, $1::timestamptz < now() AS expired`, [rev.valid_until]);
  if (nowRows[0]?.expired) reasons.push('OFFER_EXPIRED');

  const { rows: appr } = await pool.query(
    `SELECT decision FROM ops.offer_approvals WHERE offer_revision_id = $1`,
    [rev.id],
  );
  if (!appr[0] || appr[0].decision !== 'APPROVED') reasons.push('APPROVAL_MISSING');

  const fresh = await isTariffEvaluationCurrent(pool, rev.evaluation_id);
  if (!fresh.current) reasons.push('EVALUATION_STALE');

  if (await hasTakeover(pool, rev.case_id)) reasons.push('TAKEOVER');

  const unique = [...new Set(reasons)];
  return { ok: unique.length === 0, reasons: unique, revision: rev };
}

/**
 * Same DB transaction as A4 provider-accepted write.
 */
export async function markOfferSentIfProviderAccepted(client, intent) {
  if (!intent?.id) return { ok: false };
  if (intent.purpose !== 'OFFER_DELIVERY') return { ok: true, skipped: true };
  const { rows } = await client.query(
    `UPDATE ops.offer_revisions
     SET state = 'SENT'
     WHERE delivery_intent_id = $1
       AND state IN ('READY','APPROVED')
       AND is_current = true
     RETURNING id, offer_id, valid_until`,
    [intent.id],
  );
  const rev = rows[0];
  if (!rev) return { ok: true, already: true };
  await client.query(
    `UPDATE ops.offers SET status = 'SENT', updated_at = now()
     WHERE id = $1 AND status IN ('READY','APPROVED','DRAFT')`,
    [rev.offer_id],
  );
  await client.query(
    `INSERT INTO public.audit_events (event_type, detail)
     VALUES ('offer.sent',$1::jsonb)`,
    [JSON.stringify({ offer_revision_id: rev.id, intent_id: intent.id, case_id: intent.case_id })],
  );

  const wf = await loadWorkflow(client, intent.case_id);
  if (wf) {
    const due = new Date(Date.now() + 50).toISOString();
    await createFollowOnJob(client, {
      workflowInstanceId: wf.id,
      jobType: OFFER_FOLLOWUP_DUE_CAPABILITY,
      idempotencyKey: `offer-followup:${rev.id}:1`,
      correlationId: wf.correlation_id,
      controlVersion: wf.control_version_at_start,
      priority: 70,
      scheduledAt: due,
      payloadRedacted: {
        case_id: intent.case_id,
        offer_revision_id: rev.id,
        generation: 1,
        schema_version: 1,
      },
    });
  }
  return { ok: true, revisionId: rev.id };
}
