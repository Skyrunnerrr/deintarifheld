/**
 * A8 prepare: copy A7 evaluation into an immutable commercial snapshot.
 * Does not import calculateTariffCost / evaluateTariffEligibility / rankEligibleResults.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  KillDomain,
  EvaluationReadiness,
  EligibilityStatus,
  B2B_INBOUND_WORKFLOW_TYPE,
  OFFER_PREPARE_CAPABILITY,
  OFFER_DELIVER_CAPABILITY,
  OFFER_APPROVAL_REQUEST_CAPABILITY,
  OFFER_EXPIRE_CAPABILITY,
  OfferState,
  OfferSourceKind,
  OfferEnvironmentMarker,
  OfferCustomerLiveMarker,
  OfferApprovalDecision,
  A8_OFFER_POLICY_ID,
  A8_OFFER_POLICY_VERSION,
  A8_APPROVAL_POLICY_ID,
  A8_APPROVAL_POLICY_VERSION,
} from '@deintarifheld/shared';
import { getCurrentTariffEvaluation, isTariffEvaluationCurrent } from '../a7/handoff.js';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { createFollowOnJob } from '../workflow/instances.js';
import { tryMergeOfferPolicy } from './policy.js';

export function mintOfferToken() {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export function hashOfferToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

export async function offerControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return {
        ok: false,
        code: snap.globalKillActive ? 'GLOBAL_KILL' : 'OFFER_DOMAIN_KILL',
        snap,
      };
    }
    const mailSnap = await readFreshControlSnapshot(pool, { domain: KillDomain.INTERNAL_MAIL });
    return { ok: true, snap, mailSnap };
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE' };
    }
    throw err;
  }
}

export async function hasTakeover(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM security.control_state
     WHERE scope = 'WORKFLOW' AND state = 'TAKEOVER'
       AND scope_key IN (SELECT id::text FROM workflow.workflow_instances WHERE case_id = $1)
     LIMIT 1`,
    [caseId],
  );
  return rows.length > 0;
}

export async function resolveOfferContact(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.source_lead_id, c.status AS case_status,
            l.email, l.firma, l.payload
     FROM public.cases c
     JOIN public.leads l ON l.id = c.source_lead_id
     WHERE c.id = $1 AND c.deleted_at IS NULL AND l.deleted_at IS NULL`,
    [caseId],
  );
  const row = rows[0];
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    caseId: row.id,
    leadId: row.source_lead_id,
    caseStatus: row.case_status,
    email: String(row.email || payload.email || '').trim().toLowerCase(),
    ansprechpartner: String(payload.ansprechpartner || '').trim(),
    firma: row.firma,
  };
}

export function isCaseActive(status) {
  return status === 'open' || status === 'in_progress' || status === 'waiting';
}

export async function loadWorkflow(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT id, correlation_id, control_version_at_start, status
     FROM workflow.workflow_instances
     WHERE case_id = $1 AND workflow_type = $2
     ORDER BY created_at DESC LIMIT 1`,
    [caseId, B2B_INBOUND_WORKFLOW_TYPE],
  );
  return rows[0] || null;
}

function stringifyMicro(v) {
  if (v == null) return null;
  return String(v);
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

export function hashCanonical(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function selectEligibleOptions(results, policy) {
  const eligible = (results || []).filter(
    (r) => r.eligibilityStatus === EligibilityStatus.ELIGIBLE && r.rank != null,
  );
  eligible.sort((a, b) => Number(a.rank) - Number(b.rank));
  const max = Math.max(1, Number(policy.maxOptions || 1));
  if (policy.selectionMode === 'TEST_AUTO_SELECT_RANK_1' || !policy.selectionMode) {
    return eligible.slice(0, max);
  }
  return eligible.slice(0, max);
}

export function buildCommercialSnapshot({ evaluation, selected, policy }) {
  const first = selected[0];
  return {
    schema: 'A8CommercialSnapshotV1',
    evaluation_id: String(evaluation.evaluationId),
    evaluation_fingerprint: String(evaluation.fingerprint),
    profile_fingerprint: evaluation.profile?.fingerprint || null,
    catalogue_snapshot_id: evaluation.catalogueSnapshotId ? String(evaluation.catalogueSnapshotId) : null,
    calculation_policy_version: evaluation.calculationPolicyVersion,
    ranking_policy_version: evaluation.rankingPolicyVersion,
    offer_policy_id: policy.id || A8_OFFER_POLICY_ID,
    offer_policy_version: policy.version || A8_OFFER_POLICY_VERSION,
    source_kind: OfferSourceKind.TEST_FIXTURE,
    environment_marker: OfferEnvironmentMarker.TEST_ONLY,
    synthetic: true,
    customer_deliverable_live: false,
    customer_live_marker: OfferCustomerLiveMarker.NOT_CUSTOMER_DELIVERABLE_LIVE,
    currency: first?.currency || 'EUR',
    price_basis: first?.priceBasis || 'NET',
    validity_ms: policy.validityMs,
    options: selected.map((r, i) => ({
      option_index: i + 1,
      tariff_version_id: String(r.tariffVersionId),
      rank: r.rank,
      eligibility_status: r.eligibilityStatus,
      product_code: r.productCode,
      supplier_name: r.supplierName,
      energy_type: r.energyType,
      currency: r.currency,
      price_basis: r.priceBasis,
      ongoing_annual_micro: stringifyMicro(r.ongoingAnnualMicro),
      first_year_annual_micro: stringifyMicro(r.firstYearAnnualMicro),
      savings_ongoing_micro: stringifyMicro(r.savingsOngoingMicro),
      savings_first_year_micro: stringifyMicro(r.savingsFirstYearMicro),
      comparable: r.comparable === true,
      component_trace: r.componentTrace || [],
    })),
  };
}

export function commercialFingerprint({ snapshot, policy }) {
  return hashCanonical({
    evaluation_id: snapshot.evaluation_id,
    evaluation_fingerprint: snapshot.evaluation_fingerprint,
    profile_fingerprint: snapshot.profile_fingerprint,
    catalogue_snapshot_id: snapshot.catalogue_snapshot_id,
    options: snapshot.options.map((o) => ({
      tariff_version_id: o.tariff_version_id,
      rank: o.rank,
      ongoing_annual_micro: o.ongoing_annual_micro,
      first_year_annual_micro: o.first_year_annual_micro,
      savings_ongoing_micro: o.savings_ongoing_micro,
      savings_first_year_micro: o.savings_first_year_micro,
      price_basis: o.price_basis,
      currency: o.currency,
    })),
    validity_ms: policy.validityMs,
    max_options: policy.maxOptions,
    template_id: policy.templateId,
    template_version: policy.templateVersion,
    auto_approve: policy.autoApproveSynthetic && !policy.requireApproval,
  });
}

async function enqueueOfferJob(pool, {
  caseId, jobType, idempotencyKey, payload, scheduledAt = null, priority = 80,
}) {
  const wf = await loadWorkflow(pool, caseId);
  if (!wf) return { ok: false, code: 'WORKFLOW_MISSING' };
  const job = await createFollowOnJob(pool, {
    workflowInstanceId: wf.id,
    jobType,
    idempotencyKey,
    correlationId: wf.correlation_id,
    controlVersion: wf.control_version_at_start,
    priority,
    scheduledAt,
    payloadRedacted: payload,
  });
  return { ok: true, jobId: job.id, inserted: job.inserted };
}

export { enqueueOfferJob };

/**
 * prepareOffer — server-side selection from A7 eligible ranked results only.
 */
export async function prepareOffer(pool, {
  caseId,
  policy: policyOver = {},
  requireApproval = false,
  now = new Date(),
} = {}) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };

  const merged = tryMergeOfferPolicy({ ...policyOver, requireApproval });
  if (!merged.ok) return { ok: false, code: merged.code };
  const policy = { ...merged.policy, requireApproval: requireApproval === true };

  const gate = await offerControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };

  if (await hasTakeover(pool, caseId)) {
    return { ok: false, code: 'TAKEOVER' };
  }

  const contact = await resolveOfferContact(pool, caseId);
  if (!contact) return { ok: false, code: 'CASE_NOT_FOUND' };
  if (!isCaseActive(contact.caseStatus)) return { ok: false, code: 'CASE_NOT_ACTIVE' };

  const evaluation = await getCurrentTariffEvaluation(pool, caseId);
  if (!evaluation.found) return { ok: false, code: 'EVALUATION_NOT_FOUND' };
  if (!evaluation.fresh) return { ok: false, code: 'EVALUATION_STALE', staleReasons: evaluation.staleReasons };
  if (evaluation.readiness !== EvaluationReadiness.READY_FOR_OFFER && evaluation.readiness !== policy.offerableReadiness) {
    return { ok: false, code: 'NOT_READY_FOR_OFFER', readiness: evaluation.readiness };
  }

  const current = await isTariffEvaluationCurrent(pool, evaluation.evaluationId);
  if (!current.current) return { ok: false, code: 'EVALUATION_STALE', staleReasons: current.reasons };

  const selected = selectEligibleOptions(evaluation.results, policy);
  if (!selected.length) return { ok: false, code: 'NO_ELIGIBLE_TARIFF' };

  const snapshot = buildCommercialSnapshot({ evaluation, selected, policy });
  const snapshotHash = hashCanonical(snapshot);
  const fingerprint = commercialFingerprint({ snapshot, policy });

  const { rows: existingCurrent } = await pool.query(
    `SELECT o.id AS offer_id, r.*
     FROM ops.offers o
     JOIN ops.offer_revisions r ON r.id = o.current_revision_id
     WHERE o.case_id = $1 AND o.is_current = true
     LIMIT 1`,
    [caseId],
  );
  const existing = existingCurrent[0];
  if (existing && ['ACCEPTED'].includes(existing.state)) {
    return { ok: false, code: 'ALREADY_ACCEPTED', offerId: existing.offer_id, revisionId: existing.id };
  }

  if (
    existing
    && existing.fingerprint === fingerprint
    && existing.is_current
    && ['DRAFT', 'APPROVAL_REQUIRED', 'APPROVED', 'READY', 'SENT'].includes(existing.state)
  ) {
    return {
      ok: true,
      reused: true,
      offerId: existing.offer_id,
      revisionId: existing.id,
      revision: existing.revision,
      state: existing.state,
      fingerprint,
      token: null,
      capability: OFFER_PREPARE_CAPABILITY,
    };
  }

  const autoApprove = policy.autoApproveSynthetic === true
    && snapshot.source_kind === OfferSourceKind.TEST_FIXTURE
    && !policy.requireApproval;
  const initialState = autoApprove ? OfferState.READY : OfferState.APPROVAL_REQUIRED;
  const validUntil = new Date(now.getTime() + Number(policy.validityMs || OfferPolicyFallbackMs()));
  const { token, tokenHash } = mintOfferToken();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let offerId;
    if (existing?.offer_id) {
      offerId = existing.offer_id;
      await client.query(
        `UPDATE ops.offer_revisions
         SET is_current = false, state = CASE WHEN state IN ('SUPERSEDED','EXPIRED','ACCEPTED','REJECTED','CANCELLED','INVALIDATED') THEN state ELSE 'SUPERSEDED' END
         WHERE offer_id = $1 AND is_current = true`,
        [offerId],
      );
      await client.query(
        `UPDATE ops.offer_tokens SET superseded_at = now()
         WHERE offer_revision_id IN (SELECT id FROM ops.offer_revisions WHERE offer_id = $1)
           AND superseded_at IS NULL`,
        [offerId],
      );
    } else {
      const ins = await client.query(
        `INSERT INTO ops.offers (case_id, status, is_current)
         VALUES ($1,$2,true)
         RETURNING id`,
        [caseId, initialState],
      );
      offerId = ins.rows[0].id;
    }

    const { rows: revMax } = await client.query(
      `SELECT COALESCE(MAX(revision), 0)::int AS n FROM ops.offer_revisions WHERE offer_id = $1`,
      [offerId],
    );
    const revisionNo = (revMax[0]?.n || 0) + 1;

    const { rows: revRows } = await client.query(
      `INSERT INTO ops.offer_revisions
        (offer_id, revision, is_current, evaluation_id, evaluation_fingerprint, profile_fingerprint,
         catalogue_snapshot_id, commercial_snapshot, commercial_snapshot_hash, fingerprint,
         offer_policy_id, offer_policy_version, approval_policy_id, approval_policy_version,
         calculation_policy_version, ranking_policy_version, price_basis, currency, valid_until,
         state, source_kind, environment_marker, customer_deliverable_live, synthetic,
         template_id, template_version)
       VALUES ($1,$2,true,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,false,true,$22,$23)
       RETURNING *`,
      [
        offerId,
        revisionNo,
        evaluation.evaluationId,
        evaluation.fingerprint,
        evaluation.profile?.fingerprint || '',
        evaluation.catalogueSnapshotId,
        JSON.stringify(snapshot),
        snapshotHash,
        fingerprint,
        policy.id || A8_OFFER_POLICY_ID,
        policy.version || A8_OFFER_POLICY_VERSION,
        policy.approvalPolicyId || A8_APPROVAL_POLICY_ID,
        policy.approvalPolicyVersion || A8_APPROVAL_POLICY_VERSION,
        evaluation.calculationPolicyVersion,
        evaluation.rankingPolicyVersion,
        snapshot.price_basis,
        snapshot.currency,
        validUntil.toISOString(),
        initialState,
        OfferSourceKind.TEST_FIXTURE,
        OfferEnvironmentMarker.TEST_ONLY,
        policy.templateId,
        policy.templateVersion,
      ],
    );
    const revision = revRows[0];

    for (const opt of snapshot.options) {
      const src = selected[opt.option_index - 1];
      await client.query(
        `INSERT INTO ops.offer_options
          (offer_revision_id, option_index, tariff_version_id, rank, eligibility_status,
           ongoing_annual_micro, first_year_annual_micro, savings_ongoing_micro, savings_first_year_micro,
           comparable, currency, price_basis, supplier_name, product_code, energy_type, component_trace)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)`,
        [
          revision.id,
          opt.option_index,
          opt.tariff_version_id,
          opt.rank,
          opt.eligibility_status,
          opt.ongoing_annual_micro,
          opt.first_year_annual_micro,
          opt.savings_ongoing_micro,
          opt.savings_first_year_micro,
          opt.comparable,
          opt.currency,
          opt.price_basis,
          src.supplierName,
          src.productCode,
          src.energyType,
          JSON.stringify(src.componentTrace || []),
        ],
      );
    }

    await client.query(
      `INSERT INTO ops.offer_tokens (offer_revision_id, token_hash, expires_at)
       VALUES ($1,$2,$3)`,
      [revision.id, tokenHash, validUntil.toISOString()],
    );

    await client.query(
      `INSERT INTO ops.offer_approvals (offer_revision_id, policy_version, decision, actor_type, reason_code, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        revision.id,
        policy.approvalPolicyVersion || A8_APPROVAL_POLICY_VERSION,
        autoApprove ? OfferApprovalDecision.APPROVED : OfferApprovalDecision.PENDING,
        autoApprove ? 'SYSTEM_TEST' : null,
        autoApprove ? 'AUTO_APPROVE_SYNTHETIC' : null,
        autoApprove ? new Date(now).toISOString() : null,
      ],
    );

    await client.query(
      `UPDATE ops.offers
       SET current_revision_id = $2, status = $3, updated_at = now()
       WHERE id = $1`,
      [offerId, revision.id, initialState],
    );

    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('offer.prepared',$1::jsonb)`,
      [JSON.stringify({
        case_id: caseId,
        offer_id: offerId,
        revision_id: revision.id,
        state: initialState,
        synthetic: true,
        environment_marker: OfferEnvironmentMarker.TEST_ONLY,
      })],
    );

    await client.query('COMMIT');

    if (autoApprove) {
      await enqueueOfferJob(pool, {
        caseId,
        jobType: OFFER_DELIVER_CAPABILITY,
        idempotencyKey: `offer-deliver:${revision.id}`,
        payload: { case_id: caseId, offer_revision_id: revision.id, schema_version: 1 },
        priority: 90,
      });
      await enqueueOfferJob(pool, {
        caseId,
        jobType: OFFER_EXPIRE_CAPABILITY,
        idempotencyKey: `offer-expire:${revision.id}`,
        scheduledAt: validUntil.toISOString(),
        payload: { case_id: caseId, offer_revision_id: revision.id, schema_version: 1 },
        priority: 60,
      });
    } else {
      await enqueueOfferJob(pool, {
        caseId,
        jobType: OFFER_APPROVAL_REQUEST_CAPABILITY,
        idempotencyKey: `offer-approval:${revision.id}`,
        payload: { case_id: caseId, offer_revision_id: revision.id, schema_version: 1 },
        priority: 70,
      });
    }

    return {
      ok: true,
      reused: false,
      offerId,
      revisionId: revision.id,
      revision: revisionNo,
      state: initialState,
      fingerprint,
      snapshotHash,
      token,
      autoApproved: autoApprove,
      capability: OFFER_PREPARE_CAPABILITY,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

function OfferPolicyFallbackMs() {
  return 10 * 60 * 1000;
}

export async function getCurrentOffer(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT o.id AS offer_id, o.status, o.is_current AS offer_is_current, r.*
     FROM ops.offers o
     LEFT JOIN ops.offer_revisions r ON r.id = o.current_revision_id
     WHERE o.case_id = $1 AND o.is_current = true
     LIMIT 1`,
    [caseId],
  );
  return rows[0] || null;
}
