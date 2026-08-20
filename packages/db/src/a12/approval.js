/**
 * Revision-bound content approval. Stale hash cannot publish.
 */
import { ContentStatus, ContentApprovalDecision, A12_APPROVAL_POLICY_ID } from '@deintarifheld/shared';
import { contentControlGate } from './policy.js';

export async function approveContentRevision(pool, {
  revisionId,
  actorType = 'HUMAN',
  expectedHash = null,
} = {}) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const gate = await contentControlGate(pool);
  if (!gate.ok && gate.code === 'CONTROL_UNAVAILABLE') return { ok: false, code: gate.code };

  const { rows } = await pool.query(`SELECT * FROM ops.content_revisions WHERE id=$1`, [revisionId]);
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, code: 'STALE_CONTENT_REVISION' };
  if (expectedHash && expectedHash !== rev.content_hash) {
    return { ok: false, code: 'STALE_CONTENT_APPROVAL' };
  }

  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.content_approvals WHERE content_revision_id=$1`,
    [revisionId],
  );
  const row = appr[0];
  if (!row) return { ok: false, code: 'APPROVAL_ROW_MISSING' };
  if (row.decision === ContentApprovalDecision.APPROVED && row.content_hash === rev.content_hash) {
    return { ok: true, duplicate: true, revisionId, decision: 'APPROVED' };
  }
  if (row.content_hash !== rev.content_hash) {
    return { ok: false, code: 'STALE_CONTENT_APPROVAL' };
  }
  if (row.decision === ContentApprovalDecision.REJECTED) {
    return { ok: false, code: 'APPROVAL_ALREADY_DECIDED', decision: row.decision };
  }

  await pool.query(
    `UPDATE ops.content_approvals
     SET decision='APPROVED', actor_type=$2, decided_at=now(), content_hash=$3
     WHERE content_revision_id=$1`,
    [revisionId, actorType, rev.content_hash],
  );
  await pool.query(
    `UPDATE ops.content_items SET status=$2, updated_at=now() WHERE id=$1`,
    [rev.content_item_id, ContentStatus.APPROVED],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.approved',$1::jsonb)`,
    [JSON.stringify({
      content_revision_id: revisionId,
      actor_type: actorType,
      content_hash: rev.content_hash,
      policy_id: A12_APPROVAL_POLICY_ID,
    })],
  );
  return { ok: true, revisionId, decision: 'APPROVED', contentHash: rev.content_hash };
}

export async function rejectContentRevision(pool, {
  revisionId,
  actorType = 'HUMAN',
  reasonCode = 'OPERATOR_REJECTED',
} = {}) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const { rows } = await pool.query(`SELECT * FROM ops.content_revisions WHERE id=$1`, [revisionId]);
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, code: 'STALE_CONTENT_REVISION' };
  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.content_approvals WHERE content_revision_id=$1`,
    [revisionId],
  );
  if (!appr[0]) return { ok: false, code: 'APPROVAL_ROW_MISSING' };
  if (appr[0].decision === ContentApprovalDecision.REJECTED) {
    return { ok: true, duplicate: true, revisionId, decision: 'REJECTED' };
  }
  if (appr[0].decision !== ContentApprovalDecision.PENDING) {
    return { ok: false, code: 'APPROVAL_ALREADY_DECIDED', decision: appr[0].decision };
  }
  await pool.query(
    `UPDATE ops.content_approvals
     SET decision='REJECTED', actor_type=$2, decided_at=now()
     WHERE content_revision_id=$1 AND decision='PENDING'`,
    [revisionId, actorType],
  );
  await pool.query(
    `UPDATE ops.content_items SET status=$2, updated_at=now() WHERE id=$1`,
    [rev.content_item_id, ContentStatus.BLOCKED],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.validation_failed',$1::jsonb)`,
    [JSON.stringify({ content_revision_id: revisionId, reason_code: reasonCode, actor_type: actorType })],
  );
  return { ok: true, revisionId, decision: 'REJECTED' };
}
