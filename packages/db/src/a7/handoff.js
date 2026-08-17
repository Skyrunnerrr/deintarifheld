/**
 * A8 handoff helpers — current evaluation read + staleness check.
 */
import { getCurrentEnergyProfile } from './profile.js';
import { getActiveCatalogueSnapshot } from './catalogue.js';
import {
  A7_CALCULATION_POLICY_VERSION,
  A7_RANKING_POLICY_VERSION,
  OFFER_PREPARE_HANDOFF,
  EvaluationReadiness,
} from '@deintarifheld/shared';
import { createHash } from 'node:crypto';

function evalFingerprint({ caseId, profileFp, snapshotHash, calcVer, rankVer }) {
  return createHash('sha256')
    .update([caseId, profileFp, snapshotHash || 'EMPTY', String(calcVer), String(rankVer)].join('|'))
    .digest('hex');
}

/**
 * Bounded A8 input: current evaluation + profile summary. No offer generation.
 */
export async function getCurrentTariffEvaluation(pool, caseId) {
  if (!caseId) throw new Error('CASE_ID_REQUIRED');
  const { rows } = await pool.query(
    `SELECT * FROM ops.tariff_evaluations WHERE case_id = $1 AND is_current = true`,
    [caseId],
  );
  const ev = rows[0];
  if (!ev) {
    return {
      caseId,
      found: false,
      current: false,
      nextCapability: OFFER_PREPARE_HANDOFF,
      offerReady: false,
    };
  }
  const profile = await getCurrentEnergyProfile(pool, caseId);
  const { rows: results } = await pool.query(
    `SELECT r.*, v.version, v.currency, v.price_basis, v.source_kind, v.source_ref, v.source_hash,
            p.product_code, p.energy_type, p.customer_segment, s.name AS supplier_name
     FROM ops.tariff_evaluation_results r
     JOIN ops.tariff_versions v ON v.id = r.tariff_version_id
     JOIN ops.tariff_products p ON p.id = v.product_id
     JOIN ops.tariff_suppliers s ON s.id = p.supplier_id
     WHERE r.evaluation_id = $1
     ORDER BY r.rank NULLS LAST, r.tariff_version_id`,
    [ev.id],
  );

  const freshness = await isTariffEvaluationCurrent(pool, ev.id);

  return {
    caseId,
    found: true,
    evaluationId: ev.id,
    readiness: ev.readiness,
    status: ev.status,
    isCurrent: ev.is_current,
    fresh: freshness.current,
    staleReasons: freshness.reasons,
    fingerprint: ev.fingerprint,
    calculationPolicyVersion: ev.calculation_policy_version,
    rankingPolicyVersion: ev.ranking_policy_version,
    catalogueSnapshotId: ev.catalogue_snapshot_id,
    profile: profile
      ? {
          profileId: profile.id,
          revision: profile.revision,
          fingerprint: profile.fingerprint,
          energyType: profile.energyType,
          annualConsumptionKwh: profile.annualConsumptionKwh != null ? String(profile.annualConsumptionKwh) : null,
          supplyPointCount: profile.supplyPointCount,
          postcode: profile.postcode,
          baselineAnnualMicro: profile.baselineAnnualMicro != null ? String(profile.baselineAnnualMicro) : null,
          baselineBasis: profile.baselineBasis,
          baselineCurrency: profile.baselineCurrency,
          baselineSource: profile.baselineSource,
          readiness: profile.readiness,
        }
      : null,
    results: results.map((r) => ({
      tariffVersionId: r.tariff_version_id,
      productCode: r.product_code,
      supplierName: r.supplier_name,
      energyType: r.energy_type,
      customerSegment: r.customer_segment,
      eligibilityStatus: r.eligibility_status,
      reasonCodes: r.reason_codes,
      ongoingAnnualMicro: r.ongoing_annual_micro != null ? String(r.ongoing_annual_micro) : null,
      firstYearAnnualMicro: r.first_year_annual_micro != null ? String(r.first_year_annual_micro) : null,
      savingsOngoingMicro: r.savings_ongoing_micro != null ? String(r.savings_ongoing_micro) : null,
      savingsFirstYearMicro: r.savings_first_year_micro != null ? String(r.savings_first_year_micro) : null,
      rank: r.rank,
      comparable: r.comparable,
      currency: r.currency,
      priceBasis: r.price_basis,
      sourceKind: r.source_kind,
      sourceRef: r.source_ref,
      sourceHash: r.source_hash,
      componentTrace: r.component_trace,
    })),
    nextCapability: OFFER_PREPARE_HANDOFF,
    offerReady: freshness.current && ev.readiness === EvaluationReadiness.READY_FOR_OFFER,
    // explicit non-equivalence
    offerGenerated: false,
    supplierSwitchInitiated: false,
  };
}

/**
 * Staleness: profile fingerprint or catalogue snapshot changed → not current for A8.
 */
export async function isTariffEvaluationCurrent(pool, evaluationId) {
  const { rows } = await pool.query(`SELECT * FROM ops.tariff_evaluations WHERE id = $1`, [evaluationId]);
  const ev = rows[0];
  if (!ev) return { current: false, reasons: ['EVALUATION_NOT_FOUND'] };
  if (!ev.is_current) return { current: false, reasons: ['NOT_MARKED_CURRENT'] };

  const profile = await getCurrentEnergyProfile(pool, ev.case_id);
  if (!profile) return { current: false, reasons: ['PROFILE_MISSING'] };
  if (profile.id !== ev.profile_id || profile.fingerprint !== (
    await pool.query(`SELECT fingerprint FROM ops.energy_profiles WHERE id = $1`, [ev.profile_id])
  ).rows[0]?.fingerprint) {
    // profile row id mismatch or superseded
  }
  const { rows: profRows } = await pool.query(
    `SELECT fingerprint FROM ops.energy_profiles WHERE id = $1`,
    [ev.profile_id],
  );
  if (!profRows[0] || profile.fingerprint !== profRows[0].fingerprint) {
    return { current: false, reasons: ['PROFILE_CHANGED'] };
  }
  // Also: current profile must still be the one used
  if (profile.id !== ev.profile_id) {
    return { current: false, reasons: ['PROFILE_SUPERSEDED'] };
  }

  const snap = await getActiveCatalogueSnapshot(pool, new Date());
  const expectedFp = evalFingerprint({
    caseId: ev.case_id,
    profileFp: profile.fingerprint,
    snapshotHash: snap.snapshotHash || (ev.readiness?.includes('CATALOGUE') ? `BLOCKED:${ev.readiness}` : 'EMPTY'),
    calcVer: A7_CALCULATION_POLICY_VERSION,
    rankVer: A7_RANKING_POLICY_VERSION,
  });
  // For completed evaluations with snapshot, compare snapshot hash membership
  if (ev.catalogue_snapshot_id) {
    if (snap.empty || snap.snapshotId !== ev.catalogue_snapshot_id) {
      // allow same hash different id
      const { rows: sh } = await pool.query(
        `SELECT snapshot_hash FROM ops.tariff_catalogue_snapshots WHERE id = $1`,
        [ev.catalogue_snapshot_id],
      );
      if (!sh[0] || sh[0].snapshot_hash !== snap.snapshotHash) {
        return { current: false, reasons: ['CATALOGUE_CHANGED'] };
      }
    }
  }

  if (ev.fingerprint !== expectedFp && ev.status === 'COMPLETED' && ev.catalogue_snapshot_id) {
    // fingerprint mismatch with current inputs
    const { rows: sh } = await pool.query(
      `SELECT snapshot_hash FROM ops.tariff_catalogue_snapshots WHERE id = $1`,
      [ev.catalogue_snapshot_id],
    );
    const alt = evalFingerprint({
      caseId: ev.case_id,
      profileFp: profile.fingerprint,
      snapshotHash: sh[0]?.snapshot_hash,
      calcVer: ev.calculation_policy_version,
      rankVer: ev.ranking_policy_version,
    });
    if (ev.fingerprint !== alt) {
      return { current: false, reasons: ['FINGERPRINT_MISMATCH'] };
    }
  }

  return { current: true, reasons: [] };
}
