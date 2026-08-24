/**
 * A8 synthetic offer approval — server only. Cannot approve a different revision.
 */
import {
  OfferState,
  OfferApprovalDecision,
  OFFER_DELIVER_CAPABILITY,
  OFFER_EXPIRE_CAPABILITY,
} from '@deintarifheld/shared';
import { isTariffEvaluationCurrent } from '../a7/handoff.js';
import { enqueueOfferJob, offerControlGate, hasTakeover } from './prepare.js';
import { isPgPool } from '../pg-pool-or-client.js';

/**
 * recordSyntheticOfferApproval — SYSTEM_TEST actor. Recheck evaluation current, then READY + enqueue deliver.
 */
export async function recordSyntheticOfferApproval(pool, {
  revisionId,
  actorType = 'SYSTEM_TEST',
  now = new Date(),
} = {}) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  if (actorType !== 'SYSTEM_TEST' && actorType !== 'HUMAN') {
    return { ok: false, code: 'ACTOR_NOT_ALLOWED' };
  }

  const gate = await offerControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };

  const { rows } = await pool.query(
    `SELECT r.*, o.case_id, o.id AS offer_id
     FROM ops.offer_revisions r
     JOIN ops.offers o ON o.id = r.offer_id
     WHERE r.id = $1`,
    [revisionId],
  );
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, code: 'REVISION_NOT_CURRENT' };
  if (['SUPERSEDED', 'CANCELLED', 'INVALIDATED', 'EXPIRED', 'ACCEPTED', 'REJECTED'].includes(rev.state)) {
    return { ok: false, code: 'REVISION_TERMINAL', state: rev.state };
  }

  if (await hasTakeover(pool, rev.case_id)) return { ok: false, code: 'TAKEOVER' };

  const fresh = await isTariffEvaluationCurrent(pool, rev.evaluation_id);
  if (!fresh.current) return { ok: false, code: 'EVALUATION_STALE', staleReasons: fresh.reasons };

  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.offer_approvals WHERE offer_revision_id = $1`,
    [revisionId],
  );
  const approval = appr[0];
  if (!approval) return { ok: false, code: 'APPROVAL_ROW_MISSING' };
  if (approval.decision === OfferApprovalDecision.APPROVED && rev.state === OfferState.READY) {
    return { ok: true, duplicate: true, revisionId, state: rev.state };
  }
  if (approval.decision === OfferApprovalDecision.REJECTED) {
    return { ok: false, code: 'APPROVAL_REJECTED' };
  }

  const runApprovalWrite = async (client) => {
    const upd = await client.query(
      `UPDATE ops.offer_approvals
       SET decision = 'APPROVED', actor_type = $2, reason_code = 'SYNTHETIC_TEST_APPROVAL', decided_at = $3
       WHERE offer_revision_id = $1 AND decision = 'PENDING'
       RETURNING id`,
      [revisionId, actorType, new Date(now).toISOString()],
    );
    if (!upd.rows[0]) {
      return { ok: false, code: 'APPROVAL_NOT_PENDING' };
    }
    await client.query(
      `UPDATE ops.offer_revisions SET state = 'READY' WHERE id = $1 AND is_current = true`,
      [revisionId],
    );
    await client.query(
      `UPDATE ops.offers SET status = 'READY', updated_at = now() WHERE id = $1`,
      [rev.offer_id],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('offer.approved',$1::jsonb)`,
      [JSON.stringify({ offer_revision_id: revisionId, actor_type: actorType })],
    );
    return { ok: true };
  };

  if (!isPgPool(pool)) {
    const write = await runApprovalWrite(pool);
    if (!write.ok) return write;
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const write = await runApprovalWrite(client);
      if (!write.ok) {
        await client.query('ROLLBACK');
        return write;
      }
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    } finally {
      client.release();
    }
  }

  await enqueueOfferJob(pool, {
    caseId: rev.case_id,
    jobType: OFFER_DELIVER_CAPABILITY,
    idempotencyKey: `offer-deliver:${revisionId}`,
    payload: { case_id: rev.case_id, offer_revision_id: revisionId, schema_version: 1 },
    priority: 90,
  });
  await enqueueOfferJob(pool, {
    caseId: rev.case_id,
    jobType: OFFER_EXPIRE_CAPABILITY,
    idempotencyKey: `offer-expire:${revisionId}`,
    scheduledAt: rev.valid_until,
    payload: { case_id: rev.case_id, offer_revision_id: revisionId, schema_version: 1 },
    priority: 60,
  });

  return { ok: true, revisionId, state: OfferState.READY };
}

export async function recordOfferApprovalRejection(pool, {
  revisionId,
  actorType = 'HUMAN',
  reasonCode = 'OPERATOR_REJECTED',
  now = new Date(),
} = {}) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT r.*, o.case_id, o.id AS offer_id
     FROM ops.offer_revisions r
     JOIN ops.offers o ON o.id = r.offer_id
     WHERE r.id = $1`,
    [revisionId],
  );
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, code: 'REVISION_NOT_CURRENT' };
  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.offer_approvals WHERE offer_revision_id = $1`,
    [revisionId],
  );
  if (!appr[0]) return { ok: false, code: 'APPROVAL_ROW_MISSING' };
  if (appr[0].decision === 'REJECTED') {
    return { ok: true, duplicate: true, revisionId, decision: 'REJECTED' };
  }
  if (appr[0].decision !== 'PENDING') {
    return { ok: false, code: 'APPROVAL_ALREADY_DECIDED', decision: appr[0].decision };
  }
  const upd = await pool.query(
    `UPDATE ops.offer_approvals
     SET decision='REJECTED', actor_type=$2, reason_code=$3, decided_at=$4
     WHERE offer_revision_id=$1 AND decision='PENDING'
     RETURNING id`,
    [revisionId, actorType, reasonCode, new Date(now).toISOString()],
  );
  if (!upd.rows[0]) return { ok: false, code: 'APPROVAL_NOT_PENDING' };
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail)
     VALUES ('offer.approval_rejected',$1::jsonb)`,
    [JSON.stringify({ offer_revision_id: revisionId, actor_type: actorType, reason_code: reasonCode })],
  );
  return { ok: true, revisionId, decision: 'REJECTED' };
}
