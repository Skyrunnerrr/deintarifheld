/**
 * A9 SWITCH_PREPARATION handoff. No supplier API. No re-ranking.
 */
import { SWITCH_PREPARATION_CAPABILITY } from '@deintarifheld/shared';
import { enqueueOfferJob } from './prepare.js';

export async function createSwitchPreparation(pool, {
  caseId,
  offerId,
  offerRevisionId,
  commercialSnapshotHash,
  selectedTariffVersionId,
  catalogueSnapshotId,
} = {}) {
  if (!offerRevisionId || !selectedTariffVersionId) {
    return { ok: false, code: 'HANDOFF_ARGS' };
  }
  const ins = await pool.query(
    `INSERT INTO ops.switch_preparations
      (case_id, offer_id, offer_revision_id, commercial_snapshot_hash,
       selected_tariff_version_id, catalogue_snapshot_id, status, supplier_switch_initiated)
     VALUES ($1,$2,$3,$4,$5,$6,'READY',false)
     ON CONFLICT (offer_revision_id) DO NOTHING
     RETURNING id`,
    [
      caseId,
      offerId,
      offerRevisionId,
      commercialSnapshotHash,
      selectedTariffVersionId,
      catalogueSnapshotId,
    ],
  );
  const inserted = Boolean(ins.rows[0]);
  const { rows } = await pool.query(
    `SELECT * FROM ops.switch_preparations WHERE offer_revision_id = $1`,
    [offerRevisionId],
  );
  const row = rows[0];
  await enqueueOfferJob(pool, {
    caseId,
    jobType: SWITCH_PREPARATION_CAPABILITY,
    idempotencyKey: `switch-prep:${offerRevisionId}`,
    payload: {
      case_id: caseId,
      offer_id: offerId,
      offer_revision_id: offerRevisionId,
      commercial_snapshot_hash: commercialSnapshotHash,
      selected_tariff_version_id: selectedTariffVersionId,
      schema_version: 1,
    },
    priority: 80,
  });
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail)
     VALUES ('offer.a9_handoff_created',$1::jsonb)`,
    [JSON.stringify({ offer_revision_id: offerRevisionId, inserted })],
  );
  return {
    ok: true,
    inserted,
    handoffId: row?.id,
    supplierSwitchInitiated: false,
    nextCapability: SWITCH_PREPARATION_CAPABILITY,
  };
}

export async function ackSwitchPreparation(pool, { offerRevisionId } = {}) {
  const { rows } = await pool.query(
    `SELECT id, supplier_switch_initiated FROM ops.switch_preparations WHERE offer_revision_id = $1`,
    [offerRevisionId],
  );
  if (!rows[0]) return { ok: false, code: 'HANDOFF_MISSING' };
  return {
    ok: true,
    handoffId: rows[0].id,
    supplierSwitchInitiated: rows[0].supplier_switch_initiated === true,
    switchPerformed: false,
  };
}
