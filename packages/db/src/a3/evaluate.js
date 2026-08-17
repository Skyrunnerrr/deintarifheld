/**
 * A3 qualification persistence + evaluation service.
 */
import {
  QualificationOutcome,
  LeadType,
  B2B_INBOUND_WORKFLOW_TYPE,
  B2B_QUALIFICATION_REEVALUATE_CAPABILITY,
  isObservationFieldAllowed,
  ObservationSourceKind,
  workflowStateForOutcome,
  RequirementStatus,
  A3_POLICY_ID,
  A3_POLICY_VERSION,
} from '@deintarifheld/shared';
import { buildFieldBag, normalizeLeadFields } from './normalize.js';
import { evaluateCallReadiness, computeInputFingerprint } from './policy.js';

async function loadCaseLead(client, caseId) {
  const { rows: cases } = await client.query(
    `SELECT id, status, source_lead_id FROM public.cases
     WHERE id = $1 AND deleted_at IS NULL`,
    [caseId],
  );
  const caseRow = cases[0];
  if (!caseRow) return { error: 'CASE_MISSING' };
  if (!caseRow.source_lead_id) return { error: 'SOURCE_LEAD_MISSING', caseRow };

  const { rows: leads } = await client.query(
    `SELECT id, lead_ref, lead_type, page_source, status, email, firma, payload
     FROM public.leads WHERE id = $1 AND deleted_at IS NULL`,
    [caseRow.source_lead_id],
  );
  const lead = leads[0];
  if (!lead) return { error: 'SOURCE_LEAD_MISSING', caseRow };

  if (lead.lead_type !== LeadType.BUSINESS_ENERGY || lead.page_source === 'career') {
    return { error: 'PURPOSE_BOUNDARY', caseRow, lead };
  }

  const { rows: dup } = await client.query(
    `SELECT count(*)::int AS n FROM public.cases
     WHERE source_lead_id = $1 AND deleted_at IS NULL`,
    [lead.id],
  );
  if (dup[0].n > 1) return { error: 'LINEAGE_INVALID', caseRow, lead };

  return { caseRow, lead };
}

async function loadObservations(client, caseId) {
  const { rows } = await client.query(
    `SELECT * FROM ops.qualification_observations
     WHERE case_id = $1
     ORDER BY created_at ASC, id ASC`,
    [caseId],
  );
  return rows;
}

function factsForStore(normalized) {
  // No raw email/phone duplication — contactability flags only
  return {
    firma_present: normalized.firma.present,
    ansprechpartner_present: normalized.ansprechpartner.present,
    email_contactability_ok: normalized.email.contactability_ok,
    telefon_present: normalized.telefon.present,
    plz: { status: normalized.plz.status },
    energieart: normalized.energieart,
    verbrauchStrom: normalized.verbrauchStrom,
    verbrauchGas: normalized.verbrauchGas,
    standorte: normalized.standorte,
    versorger: normalized.versorger,
    vertragslaufzeit: normalized.vertragslaufzeit,
    nachricht: normalized.nachricht,
  };
}

/**
 * Canonical evaluate / re-evaluate. Safe to invoke repeatedly.
 */
export async function evaluateQualification(pool, {
  caseId,
  trigger = 'START',
  failureInjector = null,
} = {}) {
  if (!caseId) throw new Error('CASE_ID_REQUIRED');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const loaded = await loadCaseLead(client, caseId);
    if (loaded.error === 'CASE_MISSING') {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('CASE_MISSING'), { permanent: true, code: 'CASE_MISSING' });
    }
    if (loaded.error === 'PURPOSE_BOUNDARY') {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('PURPOSE_BOUNDARY'), { permanent: true, code: 'PURPOSE_BOUNDARY' });
    }

    let outcome;
    let blocking_reason = null;
    let missing = [];
    let ambiguous = [];
    let contradictions = [];
    let normalized = null;
    let fingerprint = null;
    let facts = {};

    if (loaded.error === 'SOURCE_LEAD_MISSING' || loaded.error === 'LINEAGE_INVALID') {
      outcome = QualificationOutcome.SOURCE_DATA_INVALID;
      blocking_reason = loaded.error === 'LINEAGE_INVALID' ? 'LINEAGE_INVALID' : 'SOURCE_LEAD_MISSING';
      fingerprint = `invalid:${loaded.error}:${caseId}`;
      facts = { error: loaded.error };
    } else {
      const observations = await loadObservations(client, caseId);
      const payload = loaded.lead.payload && typeof loaded.lead.payload === 'object'
        ? loaded.lead.payload
        : {};
      const { bag } = buildFieldBag({
        lead: loaded.lead,
        payload,
        observations,
      });
      normalized = normalizeLeadFields(bag);
      const assessment = evaluateCallReadiness(normalized);
      outcome = assessment.outcome;
      missing = assessment.missing_requirements;
      ambiguous = assessment.ambiguous_requirements;
      contradictions = assessment.contradictions;
      blocking_reason = assessment.blocking_reason;
      facts = factsForStore(normalized);
      fingerprint = computeInputFingerprint({
        normalized,
        energyCanonical: normalized.energieart?.canonical || null,
        overlays: observations.map((o) => `${o.field_code}:${o.idempotency_key}`),
      });
    }

    const { rows: currentRows } = await client.query(
      `SELECT * FROM ops.case_qualifications
       WHERE case_id = $1 AND is_current = true
       FOR UPDATE`,
      [caseId],
    );
    const current = currentRows[0] || null;

    if (current && current.input_fingerprint === fingerprint && current.outcome === outcome) {
      await client.query('COMMIT');
      return {
        qualificationId: current.id,
        caseId,
        revision: current.revision,
        outcome: current.outcome,
        fingerprint: current.input_fingerprint,
        workflowState: workflowStateForOutcome(current.outcome),
        reused: true,
        openRequirementCount: (
          await pool.query(
            `SELECT count(*)::int AS n FROM ops.qualification_requirements
             WHERE case_id = $1 AND status = 'OPEN'`,
            [caseId],
          )
        ).rows[0].n,
      };
    }

    failureInjector?.('a3_pre_persist');

    const nextRevision = current ? current.revision + 1 : 1;
    if (current) {
      await client.query(
        `UPDATE ops.case_qualifications SET is_current = false WHERE id = $1`,
        [current.id],
      );
      await client.query(
        `UPDATE ops.qualification_requirements
         SET status = 'SUPERSEDED', superseded_at = now()
         WHERE case_id = $1 AND status = 'OPEN'`,
        [caseId],
      );
    }

    const { rows: qRows } = await client.query(
      `INSERT INTO ops.case_qualifications
        (case_id, revision, policy_id, policy_version, outcome,
         input_fingerprint, normalized_facts, blocking_reason, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,true)
       RETURNING *`,
      [
        caseId,
        nextRevision,
        A3_POLICY_ID,
        A3_POLICY_VERSION,
        outcome,
        fingerprint,
        JSON.stringify(facts),
        blocking_reason,
      ],
    );
    const qual = qRows[0];

    const openable = [
      ...missing.map((m) => ({ ...m, kind: 'missing' })),
      ...ambiguous.map((m) => ({ ...m, kind: 'ambiguous' })),
    ];
    for (const m of openable) {
      await client.query(
        `INSERT INTO ops.qualification_requirements
          (qualification_id, case_id, requirement_code, field_code, reason_code,
           required_for, status, qualification_revision)
         VALUES ($1,$2,$3,$4,$5,'CALL_READINESS','OPEN',$6)`,
        [qual.id, caseId, m.requirement_code, m.field_code, m.reason_code, nextRevision],
      );
    }

    // Invariants
    if (outcome === QualificationOutcome.QUALIFIED_FOR_CALL && openable.length > 0) {
      throw new Error('INVARIANT_QUALIFIED_WITH_OPEN');
    }
    if (outcome === QualificationOutcome.MISSING_INFORMATION && missing.length === 0) {
      throw new Error('INVARIANT_MISSING_WITHOUT_OPEN');
    }
    if (outcome === QualificationOutcome.NEEDS_HUMAN_REVIEW && !blocking_reason && ambiguous.length === 0) {
      throw new Error('INVARIANT_REVIEW_WITHOUT_REASON');
    }

    const wfState = workflowStateForOutcome(outcome);
    await client.query(
      `UPDATE workflow.workflow_instances
       SET current_state = $2, updated_at = now()
       WHERE case_id = $1 AND workflow_type = $3 AND status = 'RUNNING'`,
      [caseId, wfState, B2B_INBOUND_WORKFLOW_TYPE],
    );

    await client.query(
      `INSERT INTO public.audit_events (lead_id, event_type, detail)
       VALUES ($1,$2,$3::jsonb)`,
      [
        loaded.lead?.id || null,
        trigger === 'REEVALUATE' ? 'qualification.reassessed' : 'qualification.assessed',
        JSON.stringify({
          case_id: caseId,
          qualification_revision: nextRevision,
          policy_version: A3_POLICY_VERSION,
          outcome,
          missing_count: missing.length,
          ambiguous_count: ambiguous.length,
          contradiction_count: contradictions.length,
          // no PII
        }),
      ],
    );

    failureInjector?.('a3_before_commit');
    await client.query('COMMIT');

    return {
      qualificationId: qual.id,
      caseId,
      revision: nextRevision,
      outcome,
      fingerprint,
      workflowState: wfState,
      reused: false,
      openRequirementCount: openable.length,
      missing,
      ambiguous,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * A4-facing observation apply. Server decides resulting qualification.
 */
export async function applyQualificationObservation(pool, {
  caseId,
  fieldCode,
  value,
  sourceKind = ObservationSourceKind.SYNTHETIC_TEST,
  sourceRef = null,
  idempotencyKey,
  enqueueReevaluate = true,
} = {}) {
  if (!caseId || !idempotencyKey) {
    return { ok: false, code: 'ARGS_REQUIRED' };
  }
  if (!isObservationFieldAllowed(fieldCode)) {
    return { ok: false, code: 'FIELD_NOT_ALLOWED' };
  }
  const allowedSources = Object.values(ObservationSourceKind);
  if (!allowedSources.includes(sourceKind)) {
    return { ok: false, code: 'SOURCE_KIND_INVALID' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT * FROM ops.qualification_observations WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return {
        ok: true,
        duplicate: true,
        observationId: existing.rows[0].id,
        code: 'IDEMPOTENT_REPLAY',
      };
    }

    const { rows } = await client.query(
      `INSERT INTO ops.qualification_observations
        (case_id, field_code, value_text, source_kind, source_ref, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [caseId, fieldCode, value == null ? null : String(value), sourceKind, sourceRef, idempotencyKey],
    );

    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('qualification.observation_received',$1::jsonb)`,
      [
        JSON.stringify({
          case_id: caseId,
          field_code: fieldCode,
          source_kind: sourceKind,
          observation_id: rows[0].id,
        }),
      ],
    );

    let jobId = null;
    if (enqueueReevaluate) {
      const { rows: wfs } = await client.query(
        `SELECT id, correlation_id, control_version_at_start
         FROM workflow.workflow_instances
         WHERE case_id = $1 AND workflow_type = $2
         ORDER BY created_at DESC LIMIT 1`,
        [caseId, B2B_INBOUND_WORKFLOW_TYPE],
      );
      const wf = wfs[0];
      if (wf) {
        const idem = `b2b-qual-reeval:${caseId}:${rows[0].id}`;
        const ins = await client.query(
          `INSERT INTO workflow.jobs
            (workflow_instance_id, job_type, status, priority, max_attempts,
             idempotency_key, correlation_id, control_version, payload_redacted)
           VALUES ($1,$2,'READY',100,5,$3,$4,$5,$6::jsonb)
           ON CONFLICT (idempotency_key) DO NOTHING
           RETURNING id`,
          [
            wf.id,
            B2B_QUALIFICATION_REEVALUATE_CAPABILITY,
            idem,
            wf.correlation_id,
            wf.control_version_at_start || 1,
            JSON.stringify({ case_id: String(caseId), observation_id: rows[0].id, schema_version: 1 }),
          ],
        );
        jobId = ins.rows[0]?.id || null;
      }
    }

    await client.query('COMMIT');
    return {
      ok: true,
      duplicate: false,
      observationId: rows[0].id,
      reevaluateJobId: jobId,
      code: 'OBSERVATION_ACCEPTED',
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getCurrentQualification(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT id, case_id, revision, policy_id, policy_version, outcome,
            input_fingerprint, blocking_reason, evaluated_at, is_current
     FROM ops.case_qualifications
     WHERE case_id = $1 AND is_current = true`,
    [caseId],
  );
  return rows[0] || null;
}

export async function getOpenMissingRequirements(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT id, requirement_code, field_code, reason_code, required_for,
            status, qualification_revision, created_at
     FROM ops.qualification_requirements
     WHERE case_id = $1 AND status = 'OPEN'
     ORDER BY field_code`,
    [caseId],
  );
  return rows;
}

export async function getQualificationRevision(pool, caseId) {
  const q = await getCurrentQualification(pool, caseId);
  return q ? q.revision : null;
}

export async function isQualificationRevisionCurrent(pool, caseId, revision) {
  const current = await getQualificationRevision(pool, caseId);
  if (current == null) return { current: false, code: 'NO_QUALIFICATION' };
  if (Number(revision) !== Number(current)) {
    return { current: false, code: 'STALE_QUALIFICATION_REVISION', currentRevision: current };
  }
  return { current: true, code: 'CURRENT', currentRevision: current };
}
