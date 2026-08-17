/**
 * A7 full tariff evaluation pipeline.
 * Control gate: KillDomain.AUTOMATION_ENGINE (no 9th domain).
 * Enqueues OFFER_PREPARE placeholder for A8 (constant only).
 */
import { createHash } from 'node:crypto';
import {
  KillDomain,
  CustomerSegment,
  EligibilityStatus,
  EvaluationReadiness,
  EvaluationStatus,
  EligibilityReasonCode,
  ProfileReadiness,
  A7_CALCULATION_POLICY_VERSION,
  A7_RANKING_POLICY_VERSION,
  OFFER_PREPARE_HANDOFF,
  ENERGY_TARIFF_EVALUATION_PREPARE_CAPABILITY,
  B2B_INBOUND_WORKFLOW_TYPE,
} from '@deintarifheld/shared';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { createFollowOnJob } from '../workflow/instances.js';
import { buildEnergyProfile } from './profile.js';
import { getActiveCatalogueSnapshot, loadSnapshotTariffs, importSyntheticCatalogue } from './catalogue.js';
import { evaluateTariffEligibility } from './eligibility.js';
import { calculateTariffCost } from './pricing.js';
import { compareToBaseline } from './compare.js';
import { TariffCalculationPolicyV1, TariffRankingPolicyV1, rankEligibleResults } from './policy.js';

async function tariffControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return {
        ok: false,
        code: snap.globalKillActive ? 'GLOBAL_KILL' : 'TARIFF_DOMAIN_KILL',
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

async function hasTakeover(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM security.control_state
     WHERE scope = 'WORKFLOW' AND state = 'TAKEOVER'
       AND scope_key IN (SELECT id::text FROM workflow.workflow_instances WHERE case_id = $1)
     LIMIT 1`,
    [caseId],
  );
  return rows.length > 0;
}

function evalFingerprint({ caseId, profileFp, snapshotHash, calcVer, rankVer }) {
  return createHash('sha256')
    .update([caseId, profileFp, snapshotHash || 'EMPTY', String(calcVer), String(rankVer)].join('|'))
    .digest('hex');
}

async function loadWorkflow(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT id, correlation_id, control_version_at_start
     FROM workflow.workflow_instances
     WHERE case_id = $1 AND workflow_type = $2
     ORDER BY created_at DESC LIMIT 1`,
    [caseId, B2B_INBOUND_WORKFLOW_TYPE],
  );
  return rows[0] || null;
}

/**
 * Prepare + run evaluation (handler entry).
 */
export async function prepareTariffEvaluation(pool, opts = {}) {
  return runTariffEvaluation(pool, opts);
}

/**
 * Full pipeline: control → profile → catalogue → eligibility → pricing → compare → persist → A8 job.
 */
export async function runTariffEvaluation(pool, {
  caseId,
  at = new Date(),
  ensureCatalogue = true,
  customerSegment = CustomerSegment.BUSINESS,
  enqueueOfferPrepare = true,
} = {}) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };

  const gate = await tariffControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };

  if (await hasTakeover(pool, caseId)) {
    return { ok: false, code: 'TAKEOVER' };
  }

  if (ensureCatalogue) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ops.tariff_versions`);
    if (!rows[0]?.n) {
      await importSyntheticCatalogue(pool, { at });
    }
  }

  const built = await buildEnergyProfile(pool, caseId, { at });
  if (!built.ok) return built;
  const profile = built.profile;

  if (profile.readiness === ProfileReadiness.CONFLICT_REVIEW_REQUIRED || profile.readiness === ProfileReadiness.HUMAN_REVIEW) {
    return persistBlockedEvaluation(pool, {
      caseId,
      profile,
      readiness: EvaluationReadiness.CONFLICT_REVIEW_REQUIRED,
      reasonCodes: [EligibilityReasonCode.INPUT_CONFLICT, ...(built.reasonCodes || [])],
      snapshotId: null,
      snapshotHash: null,
      results: [],
      enqueueOfferPrepare: false,
    });
  }

  if (profile.readiness === ProfileReadiness.INPUT_REQUIRED || profile.annualConsumptionKwh == null || !profile.energyType) {
    return persistBlockedEvaluation(pool, {
      caseId,
      profile,
      readiness: EvaluationReadiness.INPUT_REQUIRED,
      reasonCodes: [EligibilityReasonCode.MISSING_REQUIRED_FACT, ...(built.reasonCodes || [])],
      snapshotId: null,
      snapshotHash: null,
      results: [],
      enqueueOfferPrepare: false,
    });
  }

  const snap = await getActiveCatalogueSnapshot(pool, at);
  if (snap.empty) {
    return persistBlockedEvaluation(pool, {
      caseId,
      profile,
      readiness: EvaluationReadiness.CATALOGUE_UNAVAILABLE,
      reasonCodes: [EligibilityReasonCode.CATALOGUE_EMPTY],
      snapshotId: null,
      snapshotHash: null,
      results: [],
      enqueueOfferPrepare: false,
    });
  }

  const fp = evalFingerprint({
    caseId,
    profileFp: profile.fingerprint,
    snapshotHash: snap.snapshotHash,
    calcVer: A7_CALCULATION_POLICY_VERSION,
    rankVer: A7_RANKING_POLICY_VERSION,
  });

  const { rows: existing } = await pool.query(
    `SELECT * FROM ops.tariff_evaluations WHERE fingerprint = $1`,
    [fp],
  );
  if (existing[0]) {
    if (!existing[0].is_current) {
      await pool.query(`UPDATE ops.tariff_evaluations SET is_current = false WHERE case_id = $1 AND is_current = true`, [caseId]);
      await pool.query(`UPDATE ops.tariff_evaluations SET is_current = true WHERE id = $1`, [existing[0].id]);
    }
    const results = await loadEvaluationResults(pool, existing[0].id);
    let offerJob = null;
    if (enqueueOfferPrepare && existing[0].readiness === EvaluationReadiness.READY_FOR_OFFER) {
      offerJob = await enqueueOfferPrepareJob(pool, caseId, existing[0].id);
    }
    return {
      ok: true,
      reused: true,
      evaluationId: existing[0].id,
      readiness: existing[0].readiness,
      status: existing[0].status,
      profile,
      results,
      offerJob,
      capability: ENERGY_TARIFF_EVALUATION_PREPARE_CAPABILITY,
      nextHandoff: OFFER_PREPARE_HANDOFF,
      calculationPolicy: TariffCalculationPolicyV1,
      rankingPolicy: TariffRankingPolicyV1,
    };
  }

  const tariffs = await loadSnapshotTariffs(pool, snap.snapshotId);
  const rawResults = [];

  for (const tariff of tariffs) {
    const elig = evaluateTariffEligibility(profile, tariff, { at, customerSegment });
    if (elig.eligibilityStatus !== EligibilityStatus.ELIGIBLE) {
      rawResults.push({
        tariffVersionId: tariff.tariffVersionId,
        eligibilityStatus: elig.eligibilityStatus,
        reasonCodes: elig.reasonCodes,
        ongoingAnnualMicro: null,
        firstYearAnnualMicro: null,
        savingsOngoingMicro: null,
        savingsFirstYearMicro: null,
        rank: null,
        componentTrace: [],
        comparable: false,
        productCode: tariff.productCode,
        energyType: tariff.energyType,
        customerSegment: tariff.customerSegment,
        currency: tariff.currency,
        priceBasis: tariff.priceBasis,
      });
      continue;
    }

    const cost = calculateTariffCost(profile, tariff, TariffCalculationPolicyV1);
    if (!cost.ok) {
      rawResults.push({
        tariffVersionId: tariff.tariffVersionId,
        eligibilityStatus: EligibilityStatus.UNRESOLVED,
        reasonCodes: [cost.code === 'UNKNOWN_COMPONENT_TYPE'
          ? EligibilityReasonCode.UNKNOWN_COMPONENT_TYPE
          : EligibilityReasonCode.MISSING_REQUIRED_FACT],
        ongoingAnnualMicro: null,
        firstYearAnnualMicro: null,
        savingsOngoingMicro: null,
        savingsFirstYearMicro: null,
        rank: null,
        componentTrace: [],
        comparable: false,
        productCode: tariff.productCode,
        energyType: tariff.energyType,
        customerSegment: tariff.customerSegment,
        currency: tariff.currency,
        priceBasis: tariff.priceBasis,
      });
      continue;
    }

    const cmp = compareToBaseline(profile, cost);
    rawResults.push({
      tariffVersionId: tariff.tariffVersionId,
      eligibilityStatus: EligibilityStatus.ELIGIBLE,
      reasonCodes: cmp.reasonCodes,
      ongoingAnnualMicro: cost.ongoingAnnualMicro,
      firstYearAnnualMicro: cost.firstYearAnnualMicro,
      savingsOngoingMicro: cmp.savingsOngoingMicro,
      savingsFirstYearMicro: cmp.savingsFirstYearMicro,
      rank: null,
      componentTrace: cost.componentTrace,
      comparable: cmp.comparable,
      productCode: tariff.productCode,
      energyType: tariff.energyType,
      customerSegment: tariff.customerSegment,
      currency: tariff.currency,
      priceBasis: tariff.priceBasis,
    });
  }

  const ranked = rankEligibleResults(rawResults);
  const rankMap = new Map(ranked.map((r) => [r.tariffVersionId, r.rank]));
  const results = rawResults.map((r) => ({
    ...r,
    rank: rankMap.get(r.tariffVersionId) ?? null,
  }));

  const eligibleCount = results.filter((r) => r.eligibilityStatus === EligibilityStatus.ELIGIBLE).length;
  let readiness = EvaluationReadiness.READY_FOR_OFFER;
  if (eligibleCount === 0) readiness = EvaluationReadiness.NO_ELIGIBLE_TARIFF;
  else if (profile.readiness === ProfileReadiness.PARTIAL) readiness = EvaluationReadiness.PARTIAL_RESULTS;

  const client = await pool.connect();
  let evaluationId;
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ops.tariff_evaluations SET is_current = false WHERE case_id = $1 AND is_current = true`,
      [caseId],
    );
    const { rows } = await client.query(
      `INSERT INTO ops.tariff_evaluations
        (case_id, profile_id, catalogue_snapshot_id, calculation_policy_version, ranking_policy_version,
         status, readiness, is_current, fingerprint, reason_codes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9)
       RETURNING *`,
      [
        caseId,
        profile.id,
        snap.snapshotId,
        A7_CALCULATION_POLICY_VERSION,
        A7_RANKING_POLICY_VERSION,
        EvaluationStatus.COMPLETED,
        readiness,
        fp,
        [],
      ],
    );
    evaluationId = rows[0].id;
    for (const r of results) {
      await client.query(
        `INSERT INTO ops.tariff_evaluation_results
          (evaluation_id, tariff_version_id, eligibility_status, reason_codes,
           ongoing_annual_micro, first_year_annual_micro, savings_ongoing_micro, savings_first_year_micro,
           rank, component_trace, comparable)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [
          evaluationId,
          r.tariffVersionId,
          r.eligibilityStatus,
          r.reasonCodes || [],
          r.ongoingAnnualMicro != null ? String(r.ongoingAnnualMicro) : null,
          r.firstYearAnnualMicro != null ? String(r.firstYearAnnualMicro) : null,
          r.savingsOngoingMicro != null ? String(r.savingsOngoingMicro) : null,
          r.savingsFirstYearMicro != null ? String(r.savingsFirstYearMicro) : null,
          r.rank,
          JSON.stringify(r.componentTrace || []),
          r.comparable,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // race: another worker inserted same fingerprint
    if (String(err?.message || '').includes('tariff_evaluations_fingerprint') || err?.code === '23505') {
      const { rows } = await pool.query(`SELECT * FROM ops.tariff_evaluations WHERE fingerprint = $1`, [fp]);
      if (rows[0]) {
        return {
          ok: true,
          reused: true,
          evaluationId: rows[0].id,
          readiness: rows[0].readiness,
          status: rows[0].status,
          profile,
          results: await loadEvaluationResults(pool, rows[0].id),
          capability: ENERGY_TARIFF_EVALUATION_PREPARE_CAPABILITY,
          nextHandoff: OFFER_PREPARE_HANDOFF,
        };
      }
    }
    throw err;
  } finally {
    client.release();
  }

  let offerJob = null;
  if (enqueueOfferPrepare && readiness === EvaluationReadiness.READY_FOR_OFFER) {
    offerJob = await enqueueOfferPrepareJob(pool, caseId, evaluationId);
  }

  return {
    ok: true,
    reused: false,
    evaluationId,
    readiness,
    status: EvaluationStatus.COMPLETED,
    profile,
    results,
    offerJob,
    catalogueSnapshotId: snap.snapshotId,
    capability: ENERGY_TARIFF_EVALUATION_PREPARE_CAPABILITY,
    nextHandoff: OFFER_PREPARE_HANDOFF,
    calculationPolicy: TariffCalculationPolicyV1,
    rankingPolicy: TariffRankingPolicyV1,
  };
}

async function persistBlockedEvaluation(pool, {
  caseId,
  profile,
  readiness,
  reasonCodes,
  snapshotId,
  snapshotHash,
  results,
  enqueueOfferPrepare,
}) {
  const fp = evalFingerprint({
    caseId,
    profileFp: profile.fingerprint,
    snapshotHash: snapshotHash || `BLOCKED:${readiness}`,
    calcVer: A7_CALCULATION_POLICY_VERSION,
    rankVer: A7_RANKING_POLICY_VERSION,
  });
  const { rows: existing } = await pool.query(
    `SELECT * FROM ops.tariff_evaluations WHERE fingerprint = $1`,
    [fp],
  );
  if (existing[0]) {
    if (!existing[0].is_current) {
      await pool.query(`UPDATE ops.tariff_evaluations SET is_current = false WHERE case_id = $1 AND is_current = true`, [caseId]);
      await pool.query(`UPDATE ops.tariff_evaluations SET is_current = true WHERE id = $1`, [existing[0].id]);
    }
    return {
      ok: true,
      reused: true,
      evaluationId: existing[0].id,
      readiness: existing[0].readiness,
      status: existing[0].status,
      profile,
      results: [],
      blocked: true,
      reasonCodes,
    };
  }
  await pool.query(
    `UPDATE ops.tariff_evaluations SET is_current = false WHERE case_id = $1 AND is_current = true`,
    [caseId],
  );
  const { rows } = await pool.query(
    `INSERT INTO ops.tariff_evaluations
      (case_id, profile_id, catalogue_snapshot_id, calculation_policy_version, ranking_policy_version,
       status, readiness, is_current, fingerprint, reason_codes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9)
     RETURNING *`,
    [
      caseId,
      profile.id,
      snapshotId,
      A7_CALCULATION_POLICY_VERSION,
      A7_RANKING_POLICY_VERSION,
      EvaluationStatus.BLOCKED,
      readiness,
      fp,
      reasonCodes,
    ],
  );
  return {
    ok: true,
    reused: false,
    evaluationId: rows[0].id,
    readiness,
    status: EvaluationStatus.BLOCKED,
    profile,
    results,
    blocked: true,
    reasonCodes,
    nextHandoff: null,
  };
}

async function enqueueOfferPrepareJob(pool, caseId, evaluationId) {
  const wf = await loadWorkflow(pool, caseId);
  if (!wf) return { ok: false, code: 'WORKFLOW_MISSING' };
  const idem = `offer-prepare:${caseId}:${evaluationId}`;
  const job = await createFollowOnJob(pool, {
    workflowInstanceId: wf.id,
    jobType: OFFER_PREPARE_HANDOFF,
    idempotencyKey: idem,
    correlationId: wf.correlation_id,
    controlVersion: wf.control_version_at_start,
    payloadRedacted: {
      case_id: caseId,
      evaluation_id: evaluationId,
      handoff: OFFER_PREPARE_HANDOFF,
      note: 'A8 placeholder — not implemented in A7',
    },
  });
  return { ok: true, jobId: job.id, inserted: job.inserted, jobType: OFFER_PREPARE_HANDOFF };
}

async function loadEvaluationResults(pool, evaluationId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.tariff_evaluation_results WHERE evaluation_id = $1 ORDER BY rank NULLS LAST, tariff_version_id`,
    [evaluationId],
  );
  return rows.map((r) => ({
    id: r.id,
    tariffVersionId: r.tariff_version_id,
    eligibilityStatus: r.eligibility_status,
    reasonCodes: r.reason_codes || [],
    ongoingAnnualMicro: r.ongoing_annual_micro != null ? BigInt(r.ongoing_annual_micro) : null,
    firstYearAnnualMicro: r.first_year_annual_micro != null ? BigInt(r.first_year_annual_micro) : null,
    savingsOngoingMicro: r.savings_ongoing_micro != null ? BigInt(r.savings_ongoing_micro) : null,
    savingsFirstYearMicro: r.savings_first_year_micro != null ? BigInt(r.savings_first_year_micro) : null,
    rank: r.rank,
    componentTrace: r.component_trace,
    comparable: r.comparable,
  }));
}
