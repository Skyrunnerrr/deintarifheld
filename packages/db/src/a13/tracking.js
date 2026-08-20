/**
 * Opaque non-PII acq_ref generation, resolve, touchpoints.
 */
import { randomBytes } from 'node:crypto';
import { TouchpointType } from '@deintarifheld/shared';

const FORBIDDEN_META_KEYS = new Set([
  'email', 'phone', 'firma', 'name', 'fingerprint', 'deviceId', 'device_id',
  'canvasHash', 'audioHash', 'ip', 'userAgent', 'ua',
]);

function makeOpaqueRef() {
  return `acq_${randomBytes(18).toString('base64url')}`;
}

function sanitizeMeta(meta = {}) {
  const out = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (FORBIDDEN_META_KEYS.has(k)) {
      continue;
    }
    if (typeof v === 'string' && /@|\d{6,}/.test(v)) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function issueAcquisitionRef(pool, { campaignId, campaignRevisionId } = {}) {
  if (!campaignId || !campaignRevisionId) return { ok: false, code: 'CAMPAIGN_REVISION_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1 AND campaign_id=$2`,
    [campaignRevisionId, campaignId],
  );
  if (!rows[0]) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rows[0].is_current) return { ok: false, code: 'STALE_CAMPAIGN_REVISION' };

  for (let i = 0; i < 5; i += 1) {
    const acqRef = makeOpaqueRef();
    if (/@|email|case_|lead_/i.test(acqRef)) continue;
    try {
      const ins = await pool.query(
        `INSERT INTO ops.acquisition_refs (acq_ref, campaign_id, campaign_revision_id)
         VALUES ($1,$2,$3) RETURNING *`,
        [acqRef, campaignId, campaignRevisionId],
      );
      return { ok: true, acqRef: ins.rows[0].acq_ref, refId: ins.rows[0].id };
    } catch (err) {
      if (String(err?.message || '').includes('unique')) continue;
      throw err;
    }
  }
  return { ok: false, code: 'REF_ISSUE_FAILED' };
}

export async function resolveAcquisitionRef(pool, acqRef) {
  if (!acqRef || typeof acqRef !== 'string') return { ok: false, code: 'REF_MISSING' };
  if (/@|^\s*$/.test(acqRef) || acqRef.length > 128) return { ok: false, code: 'REF_INVALID' };
  const { rows } = await pool.query(`SELECT * FROM ops.acquisition_refs WHERE acq_ref=$1`, [acqRef]);
  if (!rows[0]) return { ok: false, code: 'REF_UNKNOWN' };
  return {
    ok: true,
    acqRef: rows[0].acq_ref,
    campaignId: rows[0].campaign_id,
    campaignRevisionId: rows[0].campaign_revision_id,
  };
}

export async function recordTouchpoint(pool, {
  acqRef = null,
  touchpointType,
  leadId = null,
  meta = {},
} = {}) {
  if (!Object.values(TouchpointType).includes(touchpointType)) {
    return { ok: false, code: 'INVALID_TOUCHPOINT_TYPE' };
  }
  const safeMeta = sanitizeMeta(meta);
  let campaignId = null;
  let campaignRevisionId = null;
  let resolvedRef = null;
  if (acqRef) {
    const resolved = await resolveAcquisitionRef(pool, acqRef);
    if (resolved.ok) {
      campaignId = resolved.campaignId;
      campaignRevisionId = resolved.campaignRevisionId;
      resolvedRef = resolved.acqRef;
    } else {
      resolvedRef = String(acqRef).slice(0, 128);
    }
  }
  const { rows } = await pool.query(
    `INSERT INTO ops.acquisition_touchpoints
      (acq_ref, campaign_id, campaign_revision_id, touchpoint_type, lead_id, meta)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
    [resolvedRef, campaignId, campaignRevisionId, touchpointType, leadId, JSON.stringify(safeMeta)],
  );
  return { ok: true, touchpoint: rows[0], attributedCampaign: Boolean(campaignId) };
}
