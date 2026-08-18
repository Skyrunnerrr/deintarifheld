/**
 * A10 renewal cycles, evidence check, A7/A8 handoffs. No tariff math.
 */
import { createHash } from 'node:crypto';
import {
  RenewalCycleStatus,
  LifecycleStatus,
  LifecycleException,
  RENEWAL_EVALUATION_PREPARE_CAPABILITY,
  RENEWAL_OFFER_PREPARE_CAPABILITY,
  OfferPurpose,
  EvaluationReadiness,
  DocumentFactsReadiness,
} from '@deintarifheld/shared';
import { hasTakeover, enqueueOfferJob } from '../a8/prepare.js';
import { runTariffEvaluation } from '../a7/evaluate.js';
import { getCurrentTariffEvaluation } from '../a7/handoff.js';
import { getCaseEnergyEvidence } from '../a6/process.js';
import { prepareOffer } from '../a8/prepare.js';
import { lifecycleControlGate, getLifecycle, getCurrentContractSnapshot } from './prepare.js';
import { mergeLifecyclePolicy } from './policy.js';
import { addCalendarDays, todayIso } from './dates.js';

function isoDate(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function openRenewalWindow(pool, { lifecycleId, asOf = new Date(), policy: policyOver = {} } = {}) {
  if (!lifecycleId) return { ok: false, code: 'LIFECYCLE_ID_REQUIRED' };
  const gate = await lifecycleControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };
  const lc = await getLifecycle(pool, lifecycleId);
  if (!lc) return { ok: false, code: 'LIFECYCLE_NOT_FOUND' };
  if (await hasTakeover(pool, lc.case_id)) return { ok: false, code: 'TAKEOVER' };
  if (['CANCELLED', 'ENDED'].includes(lc.status)) {
    return { ok: true, skipped: true, status: lc.status };
  }
  const snap = await getCurrentContractSnapshot(pool, lifecycleId);
  if (!snap || snap.term_incomplete || !snap.notice_deadline) {
    await pool.query(
      `UPDATE ops.customer_lifecycles SET exception_code=$2, updated_at=now() WHERE id=$1`,
      [lifecycleId, LifecycleException.TIMING_UNRESOLVED],
    );
    return { ok: false, code: LifecycleException.TIMING_UNRESOLVED };
  }
  const policy = mergeLifecyclePolicy(policyOver);
  const latest = isoDate(snap.notice_deadline);
  const target = latest;
  const windowOpen = addCalendarDays(latest, -Number(policy.renewalLeadDays || 0));
  const fp = createHash('sha256').update([lc.fingerprint, windowOpen, latest, String(policy.renewalPolicyVersion)].join('|')).digest('hex');

  const { rows: cur } = await pool.query(
    `SELECT * FROM ops.renewal_cycles WHERE lifecycle_id=$1 AND is_current=true`,
    [lifecycleId],
  );
  if (cur[0] && cur[0].fingerprint === fp && ['WINDOW_OPEN', 'EVIDENCE_REQUIRED', 'EVALUATION_PENDING', 'OFFER_PENDING'].includes(cur[0].status)) {
    return { ok: true, reused: true, cycleId: cur[0].id, status: cur[0].status };
  }

  const client = await pool.connect();
  let cycleId;
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ops.renewal_cycles SET is_current=false, status='STALE' WHERE lifecycle_id=$1 AND is_current=true`,
      [lifecycleId],
    );
    const { rows: mx } = await client.query(
      `SELECT COALESCE(MAX(cycle_no),0)::int AS n FROM ops.renewal_cycles WHERE lifecycle_id=$1`,
      [lifecycleId],
    );
    const ins = await client.query(
      `INSERT INTO ops.renewal_cycles
        (lifecycle_id, cycle_no, is_current, status, window_open, target_action_date, latest_safe_action_date,
         policy_id, policy_version, fingerprint)
       VALUES ($1,$2,true,'WINDOW_OPEN',$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        lifecycleId,
        (mx[0]?.n || 0) + 1,
        windowOpen,
        target,
        latest,
        policy.renewalPolicyId,
        policy.renewalPolicyVersion,
        fp,
      ],
    );
    cycleId = ins.rows[0].id;
    await client.query(
      `UPDATE ops.customer_lifecycles SET status='RENEWAL_DUE', current_renewal_cycle_id=$2, updated_at=now() WHERE id=$1`,
      [lifecycleId, cycleId],
    );
    await client.query(
      `INSERT INTO ops.lifecycle_events (lifecycle_id, event_type, detail)
       VALUES ($1,'renewal.window_opened',$2::jsonb)`,
      [lifecycleId, JSON.stringify({ cycle_id: cycleId, window_open: windowOpen })],
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  await enqueueOfferJob(pool, {
    caseId: lc.case_id,
    jobType: RENEWAL_EVALUATION_PREPARE_CAPABILITY,
    idempotencyKey: `renewal-eval:${cycleId}`,
    payload: { lifecycle_id: lifecycleId, cycle_id: cycleId, case_id: lc.case_id, schema_version: 1 },
    priority: 80,
  });
  void asOf;
  return { ok: true, cycleId, status: RenewalCycleStatus.WINDOW_OPEN, windowOpen, latestSafeActionDate: latest };
}

export async function evaluateRenewalEvidence(pool, { lifecycleId, policy: policyOver = {} } = {}) {
  const lc = await getLifecycle(pool, lifecycleId);
  const evidence = await getCaseEnergyEvidence(pool, lc.case_id);
  if (evidence.unresolvedConflicts?.length) {
    return { ok: false, code: 'FACT_CONFLICT', ready: false };
  }
  const policy = mergeLifecyclePolicy(policyOver);
  if (policy.evidenceMaxAgeDays === 0) {
    return { ok: false, code: LifecycleException.EVIDENCE_REQUIRED, ready: false };
  }
  if (evidence.readiness === DocumentFactsReadiness.DOCUMENT_REVIEW_REQUIRED) {
    return { ok: false, code: 'FACT_CONFLICT', ready: false };
  }
  return { ok: true, ready: true, fingerprint: evidence.facts?.map((f) => f.value).join('|') || 'none' };
}

export async function prepareRenewalEvaluation(pool, { lifecycleId, cycleId, policy: policyOver = {} } = {}) {
  const gate = await lifecycleControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };
  const lc = await getLifecycle(pool, lifecycleId);
  if (!lc) return { ok: false, code: 'LIFECYCLE_NOT_FOUND' };
  if (await hasTakeover(pool, lc.case_id)) return { ok: false, code: 'TAKEOVER' };

  const evd = await evaluateRenewalEvidence(pool, { lifecycleId, policy: policyOver });
  if (!evd.ready) {
    await pool.query(
      `UPDATE ops.renewal_cycles SET status='EVIDENCE_REQUIRED' WHERE id=$1`,
      [cycleId],
    );
    await pool.query(
      `UPDATE ops.customer_lifecycles SET status='EXCEPTION', exception_code=$2, updated_at=now() WHERE id=$1`,
      [lifecycleId, evd.code],
    );
    return { ok: false, code: evd.code };
  }

  let evalResult;
  try {
    evalResult = await runTariffEvaluation(pool, { caseId: lc.case_id, enqueueOfferPrepare: false });
  } catch (err) {
    return { ok: false, code: err.code || err.message || 'EVALUATION_THREW' };
  }
  if (!evalResult.ok) {
    return { ok: false, code: evalResult.code || 'EVALUATION_FAILED' };
  }
  const evaluationId = evalResult.evaluationId;
  if (evalResult.readiness === EvaluationReadiness.NO_ELIGIBLE_TARIFF || evalResult.readiness === 'NO_ELIGIBLE_TARIFF') {
    await pool.query(`UPDATE ops.renewal_cycles SET status='NO_ELIGIBLE_TARIFF', evaluation_id=$2 WHERE id=$1`, [cycleId, evaluationId || null]);
    return { ok: true, noEligible: true, readiness: evalResult.readiness };
  }
  await pool.query(
    `UPDATE ops.renewal_cycles SET status='EVALUATION_PENDING', evaluation_id=$2 WHERE id=$1`,
    [cycleId, evaluationId],
  );
  await pool.query(
    `UPDATE ops.customer_lifecycles SET status='RENEWAL_EVALUATION_PENDING', updated_at=now() WHERE id=$1`,
    [lifecycleId],
  );
  await enqueueOfferJob(pool, {
    caseId: lc.case_id,
    jobType: RENEWAL_OFFER_PREPARE_CAPABILITY,
    idempotencyKey: `renewal-offer:${cycleId}:${evaluationId}`,
    payload: {
      lifecycle_id: lifecycleId,
      cycle_id: cycleId,
      case_id: lc.case_id,
      evaluation_id: evaluationId,
      schema_version: 1,
    },
    priority: 80,
  });
  return { ok: true, evaluationId, readiness: evalResult.readiness };
}

export async function prepareRenewalOffer(pool, { lifecycleId, cycleId } = {}) {
  const gate = await lifecycleControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };
  const lc = await getLifecycle(pool, lifecycleId);
  const { rows: cy } = await pool.query(`SELECT * FROM ops.renewal_cycles WHERE id=$1`, [cycleId]);
  const cycle = cy[0];
  if (!cycle) return { ok: false, code: 'CYCLE_NOT_FOUND' };
  const current = await getCurrentTariffEvaluation(pool, lc.case_id);
  if (!cycle.evaluation_id) return { ok: false, code: 'STALE_RENEWAL_EVALUATION' };
  if (current.evaluationId && String(current.evaluationId) !== String(cycle.evaluation_id)) {
    return { ok: false, code: 'STALE_RENEWAL_EVALUATION' };
  }
  const offer = await prepareOffer(pool, {
    caseId: lc.case_id,
    policy: { offerPurpose: OfferPurpose.RENEWAL },
  });
  if (!offer.ok) return offer;
  await pool.query(
    `UPDATE ops.renewal_cycles SET status='OFFER_PENDING', offer_revision_id=$2 WHERE id=$1`,
    [cycleId, offer.revisionId],
  );
  await pool.query(
    `UPDATE ops.customer_lifecycles SET status='RENEWAL_OFFER_PENDING', updated_at=now() WHERE id=$1`,
    [lifecycleId],
  );
  return { ok: true, ...offer, offerPurpose: OfferPurpose.RENEWAL };
}

export async function recordRenewalCustomerDecision(pool, { cycleId, accepted } = {}) {
  const { rows: cy } = await pool.query(`SELECT * FROM ops.renewal_cycles WHERE id=$1`, [cycleId]);
  const cycle = cy[0];
  if (!cycle) return { ok: false, code: 'CYCLE_NOT_FOUND' };
  if (accepted) {
    await pool.query(
      `UPDATE ops.renewal_cycles SET status='ACCEPTED_PENDING_FULFILLMENT' WHERE id=$1`,
      [cycleId],
    );
    await pool.query(
      `UPDATE ops.customer_lifecycles SET status='RENEWAL_DECISION_PENDING', updated_at=now() WHERE id=$1`,
      [cycle.lifecycle_id],
    );
    return { ok: true, status: 'ACCEPTED_PENDING_FULFILLMENT', oldLifecycleClosed: false };
  }
  await pool.query(`UPDATE ops.renewal_cycles SET status='REJECTED' WHERE id=$1`, [cycleId]);
  await pool.query(
    `UPDATE ops.customer_lifecycles SET status='RENEWAL_MONITORING', updated_at=now() WHERE id=$1 AND status NOT IN ('CANCELLED','ENDED')`,
    [cycle.lifecycle_id],
  );
  return { ok: true, status: 'REJECTED', currentContractCancelled: false };
}

export async function getCurrentRenewalCycle(pool, lifecycleId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.renewal_cycles WHERE lifecycle_id=$1 AND is_current=true`,
    [lifecycleId],
  );
  return rows[0] || null;
}
