/**
 * A9 switch preparation: bind accepted A8 offer, copy sourced facts, evaluate readiness.
 */
import {
  KillDomain,
  OfferState,
  OfferCustomerDecision,
  SwitchCaseStatus,
  SwitchAttemptState,
  SwitchReadiness,
  SwitchFieldCode,
  SwitchFactSource,
  SwitchRequirementCode,
  SWITCH_SUBMIT_CAPABILITY,
  SWITCH_PREPARATION_CAPABILITY,
  DocumentFactCode,
} from '@deintarifheld/shared';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { hasTakeover, loadWorkflow, enqueueOfferJob, isCaseActive, resolveOfferContact } from '../a8/prepare.js';
import { getCaseEnergyEvidence } from '../a6/process.js';
import { mergeSwitchingPolicy } from './policy.js';
import { buildSwitchPayload, hashSwitchPayload, validateSwitchPayload } from './payload.js';

export async function switchControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return {
        ok: false,
        code: snap.globalKillActive ? 'GLOBAL_KILL' : 'SWITCH_DOMAIN_KILL',
        snap,
      };
    }
    return { ok: true, snap };
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE' };
    }
    throw err;
  }
}

export async function loadAcceptedOfferAuthority(pool, offerRevisionId) {
  const { rows } = await pool.query(
    `SELECT r.*, o.case_id, o.id AS offer_id, o.status AS offer_status,
            d.decision, d.commercial_snapshot_hash AS accepted_hash, d.offer_option_id,
            opt.tariff_version_id, opt.product_code, opt.supplier_name, opt.energy_type,
            opt.option_index
     FROM ops.offer_revisions r
     JOIN ops.offers o ON o.id = r.offer_id
     LEFT JOIN ops.offer_customer_decisions d ON d.offer_revision_id = r.id
     LEFT JOIN ops.offer_options opt ON opt.id = d.offer_option_id
     WHERE r.id = $1`,
    [offerRevisionId],
  );
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (rev.state !== OfferState.ACCEPTED || rev.offer_status !== OfferState.ACCEPTED) {
    return { ok: false, code: 'OFFER_NOT_ACCEPTED' };
  }
  if (rev.decision !== OfferCustomerDecision.ACCEPT) {
    return { ok: false, code: 'NO_ACCEPTANCE_DECISION' };
  }
  if (rev.accepted_hash !== rev.commercial_snapshot_hash) {
    return { ok: false, code: 'SNAPSHOT_HASH_MISMATCH' };
  }
  if (!rev.tariff_version_id) {
    return { ok: false, code: 'SELECTED_TARIFF_MISSING' };
  }
  const snap = rev.commercial_snapshot || {};
  const opt = (snap.options || []).find((x) => String(x.tariff_version_id) === String(rev.tariff_version_id));
  if (!opt && snap.options?.length) {
    const byIndex = snap.options[0];
    if (String(byIndex.tariff_version_id) !== String(rev.tariff_version_id)) {
      return { ok: false, code: 'TARIFF_OUTSIDE_ACCEPTED_OFFER' };
    }
  }
  const contact = await resolveOfferContact(pool, rev.case_id);
  return {
    ok: true,
    caseId: rev.case_id,
    offerId: rev.offer_id,
    offerRevisionId: rev.id,
    commercialSnapshotHash: rev.commercial_snapshot_hash,
    tariffVersionId: String(rev.tariff_version_id),
    catalogueSnapshotId: rev.catalogue_snapshot_id,
    productCode: rev.product_code,
    supplierName: rev.supplier_name,
    energyType: rev.energy_type,
    companyName: contact?.firma || '',
    contactEmail: contact?.email || '',
    supplyPointCount: snap.options?.[0] ? 1 : 1,
    contact,
    caseStatus: contact?.caseStatus,
  };
}

async function insertFact(client, switchCaseId, fieldCode, value, source, commercial = false) {
  if (value == null || value === '') return;
  await client.query(
    `INSERT INTO ops.switch_facts (switch_case_id, field_code, value_text, source, commercial_relevant)
     VALUES ($1,$2,$3,$4,$5)`,
    [switchCaseId, fieldCode, String(value), source, commercial],
  );
}

export async function listSwitchFacts(pool, switchCaseId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (field_code) *
     FROM ops.switch_facts
     WHERE switch_case_id = $1
     ORDER BY field_code, created_at DESC`,
    [switchCaseId],
  );
  return rows;
}

export function evaluateSwitchReadiness({ payload, facts, policy, conflicts = [] }) {
  if (conflicts.length) {
    return {
      readiness: SwitchReadiness.CONFLICT_REVIEW_REQUIRED,
      missing: [],
      conflicts,
    };
  }
  const v = validateSwitchPayload(payload, policy.requiredFields);
  if (!v.ok && v.code === 'MISSING_PROVENANCE') {
    return { readiness: SwitchReadiness.MISSING_INFORMATION, missing: v.missing || [v.field], conflicts: [] };
  }
  if (!v.ok) {
    return { readiness: SwitchReadiness.MISSING_INFORMATION, missing: v.missing || [], conflicts: [] };
  }
  void facts;
  return { readiness: SwitchReadiness.READY_FOR_SUBMISSION, missing: [], conflicts: [] };
}

export async function prepareSwitch(pool, {
  offerRevisionId,
  policy: policyOver = {},
  requireApproval = false,
} = {}) {
  if (!offerRevisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const { rows: has } = await pool.query(`SELECT to_regclass('ops.switch_cases') AS c`);
  if (!has[0]?.c) return { ok: false, code: 'A9_SCHEMA_MISSING' };

  const policy = mergeSwitchingPolicy({ ...policyOver, requireApproval });
  const gate = await switchControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };

  const accepted = await loadAcceptedOfferAuthority(pool, offerRevisionId);
  if (!accepted.ok) return accepted;
  if (await hasTakeover(pool, accepted.caseId)) return { ok: false, code: 'TAKEOVER' };
  if (!isCaseActive(accepted.caseStatus)) return { ok: false, code: 'CASE_NOT_ACTIVE' };

  const { rows: existing } = await pool.query(
    `SELECT * FROM ops.switch_cases WHERE offer_revision_id = $1`,
    [offerRevisionId],
  );
  if (existing[0] && ['CONFIRMED'].includes(existing[0].status)) {
    return { ok: true, reused: true, switchCaseId: existing[0].id, status: existing[0].status };
  }

  const evidence = await getCaseEnergyEvidence(pool, accepted.caseId);
  const maloFacts = evidence.facts.filter((f) => f.factCode === DocumentFactCode.MALO_ID);
  const meterFacts = evidence.facts.filter((f) => f.factCode === DocumentFactCode.METER_NUMBER);
  const consumptionFacts = evidence.facts.filter((f) => f.factCode === DocumentFactCode.ANNUAL_CONSUMPTION_KWH);

  const client = await pool.connect();
  let switchCaseId;
  let attemptId;
  try {
    await client.query('BEGIN');
    let switchCase = existing[0];
    if (!switchCase) {
      const ins = await client.query(
        `INSERT INTO ops.switch_cases
          (case_id, offer_id, offer_revision_id, commercial_snapshot_hash,
           selected_tariff_version_id, catalogue_snapshot_id, switch_type, provider_code, status)
         VALUES ($1,$2,$3,$4,$5,$6,'SUPPLIER_CHANGE',$7,'PREPARING')
         RETURNING *`,
        [
          accepted.caseId,
          accepted.offerId,
          accepted.offerRevisionId,
          accepted.commercialSnapshotHash,
          accepted.tariffVersionId,
          accepted.catalogueSnapshotId,
          policy.providerCode,
        ],
      );
      switchCase = ins.rows[0];
    }
    switchCaseId = switchCase.id;

    await client.query(`DELETE FROM ops.switch_facts WHERE switch_case_id = $1 AND source <> 'HUMAN_VERIFIED' AND source <> 'A3_REPLY'`, [switchCaseId]);

    await insertFact(client, switchCaseId, SwitchFieldCode.COMPANY_NAME, accepted.companyName, SwitchFactSource.A2_INTAKE);
    await insertFact(client, switchCaseId, SwitchFieldCode.CONTACT_EMAIL, accepted.contactEmail, SwitchFactSource.A2_INTAKE);
    await insertFact(client, switchCaseId, SwitchFieldCode.ENERGY_TYPE, accepted.energyType, SwitchFactSource.A8_ACCEPTED_OFFER, true);
    await insertFact(client, switchCaseId, SwitchFieldCode.TARIFF_VERSION_ID, accepted.tariffVersionId, SwitchFactSource.A8_ACCEPTED_OFFER, true);
    await insertFact(client, switchCaseId, SwitchFieldCode.PRODUCT_CODE, accepted.productCode, SwitchFactSource.A8_ACCEPTED_OFFER);
    await insertFact(client, switchCaseId, SwitchFieldCode.SUPPLIER_NAME, accepted.supplierName, SwitchFactSource.A8_ACCEPTED_OFFER);
    await insertFact(client, switchCaseId, SwitchFieldCode.SUPPLY_POINT_COUNT, String(accepted.supplyPointCount || 1), SwitchFactSource.A8_ACCEPTED_OFFER);
    for (const f of maloFacts) {
      await insertFact(client, switchCaseId, SwitchFieldCode.MALO_ID, f.value, SwitchFactSource.A6_DOCUMENT);
    }
    for (const f of meterFacts) {
      await insertFact(client, switchCaseId, SwitchFieldCode.METER_NUMBER, f.value, SwitchFactSource.A6_DOCUMENT);
    }
    for (const f of consumptionFacts) {
      await insertFact(client, switchCaseId, SwitchFieldCode.CONSUMPTION_KWH, f.value, SwitchFactSource.A6_DOCUMENT, true);
    }

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  return finalizeReadiness(pool, {
    switchCaseId,
    accepted,
    policy,
    requireApproval,
    maloFacts,
  });
}

async function finalizeReadiness(pool, { switchCaseId, accepted, policy, requireApproval, maloFacts }) {
  const { rows: allMalo } = await pool.query(
    `SELECT DISTINCT value_text FROM ops.switch_facts WHERE switch_case_id=$1 AND field_code=$2`,
    [switchCaseId, SwitchFieldCode.MALO_ID],
  );
  const conflicts = allMalo.length > 1
    ? [{ field: SwitchFieldCode.MALO_ID, values: allMalo.map((r) => r.value_text) }]
    : [];
  const facts = await listSwitchFacts(pool, switchCaseId);

  const payload = buildSwitchPayload({ accepted, facts, policy });
  const ready = evaluateSwitchReadiness({ payload, facts, policy, conflicts });

  let status = SwitchCaseStatus.READY;
  let attemptState = SwitchAttemptState.READY;
  if (ready.readiness === SwitchReadiness.CONFLICT_REVIEW_REQUIRED) {
    status = SwitchCaseStatus.REVIEW_REQUIRED;
    attemptState = SwitchAttemptState.REVIEW_REQUIRED;
  } else if (ready.readiness === SwitchReadiness.MISSING_INFORMATION) {
    status = SwitchCaseStatus.MISSING_INFORMATION;
    attemptState = SwitchAttemptState.DRAFT;
  } else if (requireApproval || policy.requireApproval) {
    status = SwitchCaseStatus.APPROVAL_REQUIRED;
  }

  const payloadHash = hashSwitchPayload(payload);
  const client = await pool.connect();
  let attemptId;
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ops.switch_attempts SET is_current = false, state = CASE WHEN state IN ('CONFIRMED','SUPERSEDED') THEN state ELSE 'SUPERSEDED' END
       WHERE switch_case_id = $1 AND is_current = true AND state NOT IN ('CONFIRMED','INTENT_CREATED','SUBMISSION_ACCEPTED','SUPPLIER_PENDING','OUTCOME_UNKNOWN')`,
      [switchCaseId],
    );
    const { rows: mx } = await client.query(
      `SELECT COALESCE(MAX(attempt_no),0)::int AS n FROM ops.switch_attempts WHERE switch_case_id = $1`,
      [switchCaseId],
    );
    const { rows: cur } = await client.query(
      `SELECT * FROM ops.switch_attempts WHERE switch_case_id = $1 AND is_current = true`,
      [switchCaseId],
    );
    if (cur[0] && ['INTENT_CREATED', 'SUBMISSION_ACCEPTED', 'SUPPLIER_PENDING', 'OUTCOME_UNKNOWN', 'CONFIRMED'].includes(cur[0].state)) {
      attemptId = cur[0].id;
    } else if (cur[0] && cur[0].payload_hash === payloadHash && ['DRAFT', 'READY'].includes(cur[0].state)) {
      attemptId = cur[0].id;
      await client.query(
        `UPDATE ops.switch_attempts SET state = $2, payload_snapshot = $3::jsonb, payload_hash = $4, updated_at = now() WHERE id = $1`,
        [attemptId, attemptState, JSON.stringify(payload), payloadHash],
      );
    } else {
      const ins = await client.query(
        `INSERT INTO ops.switch_attempts
          (switch_case_id, attempt_no, is_current, state, payload_hash, payload_snapshot, payload_version,
           provider_code, supply_point_count, requested_start, idempotency_key)
         VALUES ($1,$2,true,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          switchCaseId,
          (mx[0]?.n || 0) + 1,
          attemptState,
          payloadHash,
          JSON.stringify(payload),
          payload.payload_version,
          policy.providerCode,
          payload.supply_point_count,
          payload.requested_start,
          `switch-attempt:${switchCaseId}:${(mx[0]?.n || 0) + 1}:${payloadHash}`,
        ],
      );
      attemptId = ins.rows[0].id;
    }

    const autoApprove = policy.autoApproveSynthetic !== false
      && status === SwitchCaseStatus.READY
      && !requireApproval
      && !policy.requireApproval;
    await client.query(
      `INSERT INTO ops.switch_approvals (switch_attempt_id, policy_version, payload_hash, decision, actor_type, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (switch_attempt_id) DO UPDATE SET
         payload_hash = EXCLUDED.payload_hash,
         decision = EXCLUDED.decision,
         decided_at = EXCLUDED.decided_at`,
      [
        attemptId,
        policy.submissionPolicyVersion,
        payloadHash,
        autoApprove ? 'APPROVED' : (status === SwitchCaseStatus.APPROVAL_REQUIRED ? 'PENDING' : 'PENDING'),
        autoApprove ? 'SYSTEM_TEST' : null,
        autoApprove ? new Date().toISOString() : null,
      ],
    );

    await client.query(`UPDATE ops.switch_requirements SET status='CANCELLED' WHERE switch_case_id=$1 AND status='OPEN'`, [switchCaseId]);
    if (ready.missing.includes(SwitchFieldCode.MALO_ID) || ready.missing.includes('MALO_ID')) {
      await client.query(
          `INSERT INTO ops.switch_requirements (switch_case_id, field_code, reason_code, status)
         VALUES ($1,$2,$3,'OPEN')`,
        [switchCaseId, SwitchFieldCode.MALO_ID, SwitchRequirementCode.MALO_ID_REQUIRED],
      );
    }

    await client.query(
      `UPDATE ops.switch_cases SET status=$2, current_attempt_id=$3, updated_at=now() WHERE id=$1`,
      [switchCaseId, status, attemptId],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('switch.preparation_started',$1::jsonb)`,
      [JSON.stringify({ switch_case_id: switchCaseId, offer_revision_id: accepted.offerRevisionId, status })],
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  if (status === SwitchCaseStatus.MISSING_INFORMATION) {
    const { requestSwitchMissingInfo } = await import('./communicate-switch.js');
    await requestSwitchMissingInfo(pool, {
      caseId: accepted.caseId,
      fields: ready.missing.length ? ready.missing : [SwitchFieldCode.MALO_ID],
    });
  }

  if (status === SwitchCaseStatus.READY && autoApproveOk(policy, requireApproval)) {
    await enqueueOfferJob(pool, {
      caseId: accepted.caseId,
      jobType: SWITCH_SUBMIT_CAPABILITY,
      idempotencyKey: `switch-submit:${attemptId}`,
      payload: { case_id: accepted.caseId, switch_attempt_id: attemptId, schema_version: 1 },
      priority: 90,
    });
  }

  void maloFacts;
  void SWITCH_PREPARATION_CAPABILITY;
  return {
    ok: true,
    switchCaseId,
    attemptId,
    status,
    readiness: ready.readiness,
    missing: ready.missing,
    payloadHash,
    payload,
    capability: SWITCH_PREPARATION_CAPABILITY,
  };
}

function autoApproveOk(policy, requireApproval) {
  return policy.autoApproveSynthetic !== false && !requireApproval && !policy.requireApproval;
}

export async function recordSwitchFact(pool, {
  switchCaseId, fieldCode, value, source = SwitchFactSource.HUMAN_VERIFIED, commercialRelevant = false,
} = {}) {
  if (!switchCaseId || !fieldCode || value == null) return { ok: false, code: 'FACT_ARGS' };
  const commercial = commercialRelevant || ['CONSUMPTION_KWH', 'ENERGY_TYPE', 'TARIFF_VERSION_ID'].includes(fieldCode);
  await pool.query(
    `INSERT INTO ops.switch_facts (switch_case_id, field_code, value_text, source, commercial_relevant)
     VALUES ($1,$2,$3,$4,$5)`,
    [switchCaseId, fieldCode, String(value), source, commercial],
  );
  if (fieldCode === SwitchFieldCode.MALO_ID) {
    await pool.query(
      `UPDATE ops.switch_requirements SET status='SATISFIED', satisfied_at=now()
       WHERE switch_case_id=$1 AND field_code=$2 AND status='OPEN'`,
      [switchCaseId, fieldCode],
    );
  }
  const { rows: sc } = await pool.query(`SELECT offer_revision_id FROM ops.switch_cases WHERE id=$1`, [switchCaseId]);
  if (commercial && fieldCode === SwitchFieldCode.CONSUMPTION_KWH) {
    await pool.query(
      `UPDATE ops.switch_cases SET status='REOFFER_REQUIRED', updated_at=now() WHERE id=$1`,
      [switchCaseId],
    );
    await pool.query(
      `UPDATE ops.switch_attempts SET state='REOFFER_REQUIRED', reoffer_reason='COMMERCIAL_FACT_CHANGE', is_current=true
       WHERE switch_case_id=$1 AND is_current=true`,
      [switchCaseId],
    );
    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('switch.reoffer_required',$1::jsonb)`,
      [JSON.stringify({ switch_case_id: switchCaseId, field_code: fieldCode })],
    );
    return { ok: true, reofferRequired: true, code: 'REOFFER_REQUIRED' };
  }
  return prepareSwitch(pool, { offerRevisionId: sc[0].offer_revision_id });
}

export async function getSwitchCase(pool, switchCaseId) {
  const { rows } = await pool.query(`SELECT * FROM ops.switch_cases WHERE id=$1`, [switchCaseId]);
  return rows[0] || null;
}

export async function getCurrentSwitchAttempt(pool, switchCaseId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.switch_attempts WHERE switch_case_id=$1 AND is_current=true`,
    [switchCaseId],
  );
  return rows[0] || null;
}
