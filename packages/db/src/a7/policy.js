/**
 * Central A7 calculation + ranking policies (versioned).
 */
import {
  A7_CALCULATION_POLICY_ID,
  A7_CALCULATION_POLICY_VERSION,
  A7_RANKING_POLICY_ID,
  A7_RANKING_POLICY_VERSION,
} from '@deintarifheld/shared';

/**
 * Round only final annual totals (ongoing / first_year) to integer micro-EUR.
 * Component intermediates remain exact BigInt integer micro-EUR.
 * No Math.round / Number float on commercial authority paths.
 */
export const TariffCalculationPolicyV1 = Object.freeze({
  id: A7_CALCULATION_POLICY_ID,
  version: A7_CALCULATION_POLICY_VERSION,
  rounding: 'FINAL_ANNUAL_TOTALS_ONLY',
  moneyUnit: 'MICRO_EUR',
  microScale: 1_000_000,
  energyUnitPrice: 'MICRO_EUR_PER_KWH',
});

/**
 * Rank eligible comparable results by lowest ongoing annual cost.
 * Tie-break: tariff_version_id ascending (stable, no commission).
 */
export const TariffRankingPolicyV1 = Object.freeze({
  id: A7_RANKING_POLICY_ID,
  version: A7_RANKING_POLICY_VERSION,
  primary: 'LOWEST_ONGOING_ANNUAL_MICRO',
  tieBreak: 'TARIFF_VERSION_ID_ASC',
  commissionInRanking: false,
});

export function rankEligibleResults(results) {
  const eligible = results.filter(
    (r) => r.eligibilityStatus === 'ELIGIBLE' && r.ongoingAnnualMicro != null,
  );
  const sorted = [...eligible].sort((a, b) => {
    const ao = BigInt(a.ongoingAnnualMicro);
    const bo = BigInt(b.ongoingAnnualMicro);
    if (ao < bo) return -1;
    if (ao > bo) return 1;
    return String(a.tariffVersionId).localeCompare(String(b.tariffVersionId));
  });
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}
