/**
 * Baseline comparison — savings only when comparable evidence exists.
 * Net vs net / gross vs gross / currency match required.
 * Negative savings preserved (not clamped).
 */
import { EligibilityReasonCode } from '@deintarifheld/shared';

/**
 * @returns {{ comparable: boolean, savingsOngoingMicro: bigint|null, savingsFirstYearMicro: bigint|null, reasonCodes: string[] }}
 */
export function compareToBaseline(profile, cost) {
  const reasons = [];
  if (profile.baselineAnnualMicro == null || profile.baselineSource === 'NONE') {
    return {
      comparable: false,
      savingsOngoingMicro: null,
      savingsFirstYearMicro: null,
      reasonCodes: ['BASELINE_UNKNOWN'],
    };
  }
  if (!profile.baselineCurrency || !cost.currency) {
    reasons.push(EligibilityReasonCode.CURRENCY_MISMATCH);
  } else if (profile.baselineCurrency !== cost.currency) {
    return {
      comparable: false,
      savingsOngoingMicro: null,
      savingsFirstYearMicro: null,
      reasonCodes: [EligibilityReasonCode.CURRENCY_MISMATCH],
    };
  }
  if (!profile.baselineBasis || !cost.priceBasis) {
    reasons.push(EligibilityReasonCode.PRICE_BASIS_MISMATCH);
  } else if (profile.baselineBasis !== cost.priceBasis) {
    return {
      comparable: false,
      savingsOngoingMicro: null,
      savingsFirstYearMicro: null,
      reasonCodes: [EligibilityReasonCode.PRICE_BASIS_MISMATCH],
    };
  }
  if (reasons.length) {
    return {
      comparable: false,
      savingsOngoingMicro: null,
      savingsFirstYearMicro: null,
      reasonCodes: reasons,
    };
  }

  const baseline = BigInt(profile.baselineAnnualMicro);
  const savingsOngoing = baseline - BigInt(cost.ongoingAnnualMicro);
  const savingsFirst = baseline - BigInt(cost.firstYearAnnualMicro);
  return {
    comparable: true,
    savingsOngoingMicro: savingsOngoing,
    savingsFirstYearMicro: savingsFirst,
    reasonCodes: [],
  };
}
