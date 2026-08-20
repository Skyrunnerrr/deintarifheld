/**
 * Campaign approval bound to revision + budget hash + destination + content.
 * Stale on material change. Zero-spend synthetic auto-approve test only.
 */
import {
  CampaignStatus,
  AcquisitionApprovalDecision,
  AcquisitionApprovalPolicyV1,
} from '@deintarifheld/shared';
import { acquisitionControlGate } from './policy.js';

export async function approveAcquisitionCampaign(pool, {
  revisionId,
  actorType = 'HUMAN',
  expectedBudgetHash = null,
} = {}) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const gate = await acquisitionControlGate(pool);
  if (!gate.ok && gate.code === 'CONTROL_UNAVAILABLE') return { ok: false, code: gate.code };

  const { rows } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
    [revisionId],
  );
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) {
    return { ok: false, code: 'STALE_CAMPAIGN_REVISION' };
  }
  if (expectedBudgetHash && expectedBudgetHash !== rev.budget_hash) {
    return { ok: false, code: 'STALE_CAMPAIGN_APPROVAL' };
  }

  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.campaign_approvals WHERE campaign_revision_id=$1`,
    [revisionId],
  );
  const row = appr[0];
  if (!row) return { ok: false, code: 'APPROVAL_ROW_MISSING' };

  if (
    row.decision === AcquisitionApprovalDecision.APPROVED
    && row.budget_hash === rev.budget_hash
    && row.destination === rev.destination
    && (row.content_hash || null) === (rev.content_hash || null)
  ) {
    return { ok: true, duplicate: true, revisionId, decision: 'APPROVED' };
  }

  if (
    row.budget_hash !== rev.budget_hash
    || row.destination !== rev.destination
    || (row.content_hash || null) !== (rev.content_hash || null)
  ) {
    return { ok: false, code: 'STALE_CAMPAIGN_APPROVAL' };
  }
  if (row.decision === AcquisitionApprovalDecision.REJECTED) {
    return { ok: false, code: 'APPROVAL_ALREADY_DECIDED', decision: row.decision };
  }

  await pool.query(
    `UPDATE ops.campaign_approvals
     SET decision='APPROVED', actor_type=$2, decided_at=now(),
         budget_hash=$3, destination=$4, content_hash=$5
     WHERE campaign_revision_id=$1`,
    [revisionId, actorType, rev.budget_hash, rev.destination, rev.content_hash],
  );
  await pool.query(
    `UPDATE ops.acquisition_campaigns SET status=$2, updated_at=now() WHERE id=$1`,
    [rev.campaign_id, CampaignStatus.APPROVED],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.approved',$1::jsonb)`,
    [JSON.stringify({
      campaign_revision_id: revisionId,
      actor_type: actorType,
      budget_hash: rev.budget_hash,
      policy_id: AcquisitionApprovalPolicyV1.id,
    })],
  );
  return { ok: true, revisionId, decision: 'APPROVED', budgetHash: rev.budget_hash };
}

export async function rejectAcquisitionCampaign(pool, {
  revisionId,
  actorType = 'HUMAN',
  reasonCode = 'OPERATOR_REJECTED',
} = {}) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
    [revisionId],
  );
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, code: 'STALE_CAMPAIGN_REVISION' };
  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.campaign_approvals WHERE campaign_revision_id=$1`,
    [revisionId],
  );
  if (!appr[0]) return { ok: false, code: 'APPROVAL_ROW_MISSING' };
  if (appr[0].decision === AcquisitionApprovalDecision.REJECTED) {
    return { ok: true, duplicate: true, revisionId, decision: 'REJECTED' };
  }
  if (appr[0].decision !== AcquisitionApprovalDecision.PENDING) {
    return { ok: false, code: 'APPROVAL_ALREADY_DECIDED', decision: appr[0].decision };
  }
  await pool.query(
    `UPDATE ops.campaign_approvals
     SET decision='REJECTED', actor_type=$2, decided_at=now()
     WHERE campaign_revision_id=$1 AND decision='PENDING'`,
    [revisionId, actorType],
  );
  await pool.query(
    `UPDATE ops.acquisition_campaigns SET status=$2, updated_at=now() WHERE id=$1`,
    [rev.campaign_id, CampaignStatus.BLOCKED],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.rejected',$1::jsonb)`,
    [JSON.stringify({ campaign_revision_id: revisionId, reason_code: reasonCode })],
  );
  return { ok: true, revisionId, decision: 'REJECTED' };
}

export async function loadBoundApproval(pool, revisionId, budgetHash) {
  const { rows } = await pool.query(
    `SELECT a.*, r.budget_hash AS rev_budget_hash, r.destination AS rev_destination,
            r.content_hash AS rev_content_hash, r.is_current
     FROM ops.campaign_approvals a
     JOIN ops.acquisition_campaign_revisions r ON r.id = a.campaign_revision_id
     WHERE a.campaign_revision_id=$1`,
    [revisionId],
  );
  const a = rows[0];
  if (!a || a.decision !== AcquisitionApprovalDecision.APPROVED) {
    return { ok: false, code: 'APPROVAL_MISSING' };
  }
  if (!a.is_current) return { ok: false, code: 'STALE_CAMPAIGN_REVISION' };
  if (a.budget_hash !== budgetHash || a.budget_hash !== a.rev_budget_hash) {
    return { ok: false, code: 'STALE_CAMPAIGN_APPROVAL' };
  }
  if (a.destination !== a.rev_destination) return { ok: false, code: 'STALE_CAMPAIGN_APPROVAL' };
  if ((a.content_hash || null) !== (a.rev_content_hash || null)) {
    return { ok: false, code: 'STALE_CAMPAIGN_APPROVAL' };
  }
  return { ok: true, approval: a };
}
