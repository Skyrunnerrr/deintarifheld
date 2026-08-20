/**
 * Separate raw touchpoints from primary attribution decision.
 * LAST_TRACKED_TOUCH test policy. Soft-fail never drops leads.
 */
import {
  AttributionState,
  AcquisitionAttributionPolicyV1,
  TouchpointType,
} from '@deintarifheld/shared';
import { resolveAcquisitionRef } from './tracking.js';
import { bumpA13Invariant } from './invariants.js';

export async function attributeLeadPrimary(pool, {
  leadId,
  acqRef = null,
  failureInjector = null,
} = {}) {
  if (!leadId) return { ok: false, code: 'LEAD_ID_REQUIRED' };

  const { rows: existing } = await pool.query(
    `SELECT * FROM ops.lead_attributions WHERE lead_id=$1`,
    [leadId],
  );
  if (existing[0]) {
    return {
      ok: true,
      duplicate: true,
      attribution: existing[0],
      attributionState: existing[0].attribution_state,
    };
  }

  try {
    if (failureInjector?.beforeAttribute) await failureInjector.beforeAttribute();

    let state = AttributionState.DIRECT;
    let campaignId = null;
    let campaignRevisionId = null;
    let touchpointId = null;
    let usedRef = null;

    if (acqRef) {
      const resolved = await resolveAcquisitionRef(pool, acqRef);
      if (!resolved.ok) {
        state = AttributionState.FORGED_REF_IGNORED;
        usedRef = String(acqRef).slice(0, 128);
        // no campaign credit
      } else {
        usedRef = resolved.acqRef;
        // LAST_TRACKED_TOUCH among touchpoints for this ref, else the ref itself
        const { rows: tps } = await pool.query(
          `SELECT * FROM ops.acquisition_touchpoints
           WHERE acq_ref=$1 AND campaign_id IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [usedRef],
        );
        const last = tps[0];
        campaignId = last?.campaign_id || resolved.campaignId;
        campaignRevisionId = last?.campaign_revision_id || resolved.campaignRevisionId;
        touchpointId = last?.id || null;
        state = AttributionState.ATTRIBUTED;
      }
    } else {
      state = AttributionState.DIRECT;
    }

    if (failureInjector?.beforeInsert) await failureInjector.beforeInsert();

    const { rows } = await pool.query(
      `INSERT INTO ops.lead_attributions
        (lead_id, campaign_id, campaign_revision_id, acq_ref, touchpoint_id,
         attribution_state, policy_id, policy_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (lead_id) DO NOTHING
       RETURNING *`,
      [
        leadId, campaignId, campaignRevisionId, usedRef, touchpointId, state,
        AcquisitionAttributionPolicyV1.id, AcquisitionAttributionPolicyV1.version,
      ],
    );

    if (!rows[0]) {
      const again = await pool.query(`SELECT * FROM ops.lead_attributions WHERE lead_id=$1`, [leadId]);
      return { ok: true, duplicate: true, attribution: again.rows[0], attributionState: again.rows[0]?.attribution_state };
    }

    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.lead_attributed',$1::jsonb)`,
      [JSON.stringify({
        lead_id: leadId,
        campaign_id: campaignId,
        attribution_state: state,
        policy: AcquisitionAttributionPolicyV1.model,
        touchpoint_type_authority: TouchpointType.LEAD_ACCEPTED,
      })],
    );

    return {
      ok: true,
      attribution: rows[0],
      attributionState: state,
      campaignId,
      campaignRevisionId,
      credited: state === AttributionState.ATTRIBUTED,
    };
  } catch (err) {
    // Soft-fail: never lose the lead. Caller already accepted lead.
    await pool.query(
      `INSERT INTO ops.lead_attributions
        (lead_id, attribution_state, policy_id, policy_version)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (lead_id) DO NOTHING`,
      [leadId, AttributionState.SOFT_FAIL, AcquisitionAttributionPolicyV1.id, AcquisitionAttributionPolicyV1.version],
    ).catch(() => {});
    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.attribution_soft_fail',$1::jsonb)`,
      [JSON.stringify({ lead_id: leadId, error: String(err?.message || err).slice(0, 200) })],
    ).catch(() => {});
    return {
      ok: true,
      softFail: true,
      attributionState: AttributionState.SOFT_FAIL,
      leadPreserved: true,
      code: 'ATTRIBUTION_SOFT_FAIL',
    };
  }
}
