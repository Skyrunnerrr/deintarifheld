/**
 * Pure tariff eligibility evaluation — bounded rule_type registry only.
 * UNRESOLVED ≠ INELIGIBLE.
 */
import {
  EligibilityStatus,
  EligibilityReasonCode,
  EligibilityRuleType,
  CustomerSegment,
} from '@deintarifheld/shared';

const KNOWN = new Set(Object.values(EligibilityRuleType));

/**
 * @param {object} profile
 * @param {object} tariff — version + product fields + rules
 * @param {{ at?: Date, customerSegment?: string }} opts
 */
export function evaluateTariffEligibility(profile, tariff, opts = {}) {
  const at = opts.at || new Date();
  const segment = opts.customerSegment || CustomerSegment.BUSINESS;
  const reasons = [];
  let status = EligibilityStatus.ELIGIBLE;

  // Effective window / status (catalogue should exclude, but defense in depth)
  if (tariff.status !== 'ACTIVE') {
    return {
      eligibilityStatus: EligibilityStatus.INELIGIBLE,
      reasonCodes: [EligibilityReasonCode.TARIFF_INACTIVE],
    };
  }
  const from = new Date(tariff.validFrom);
  const to = tariff.validTo ? new Date(tariff.validTo) : null;
  if (at < from) {
    return {
      eligibilityStatus: EligibilityStatus.INELIGIBLE,
      reasonCodes: [EligibilityReasonCode.TARIFF_FUTURE, EligibilityReasonCode.TARIFF_NOT_EFFECTIVE],
    };
  }
  if (to && !(at < to)) {
    return {
      eligibilityStatus: EligibilityStatus.INELIGIBLE,
      reasonCodes: [EligibilityReasonCode.TARIFF_EXPIRED, EligibilityReasonCode.TARIFF_NOT_EFFECTIVE],
    };
  }

  // Product-level energy / segment (always enforced)
  if (tariff.energyType && profile.energyType && tariff.energyType !== profile.energyType) {
    return {
      eligibilityStatus: EligibilityStatus.INELIGIBLE,
      reasonCodes: [EligibilityReasonCode.ENERGY_TYPE_MISMATCH],
    };
  }
  if (tariff.customerSegment && tariff.customerSegment !== segment) {
    return {
      eligibilityStatus: EligibilityStatus.INELIGIBLE,
      reasonCodes: [EligibilityReasonCode.CUSTOMER_SEGMENT_MISMATCH],
    };
  }
  // Private tariffs never apply to B2B
  if (tariff.customerSegment === CustomerSegment.PRIVATE && segment === CustomerSegment.BUSINESS) {
    return {
      eligibilityStatus: EligibilityStatus.INELIGIBLE,
      reasonCodes: [EligibilityReasonCode.CUSTOMER_SEGMENT_MISMATCH],
    };
  }

  for (const rule of tariff.rules || []) {
    if (!KNOWN.has(rule.ruleType)) {
      return {
        eligibilityStatus: EligibilityStatus.UNRESOLVED,
        reasonCodes: [EligibilityReasonCode.UNKNOWN_RULE_TYPE],
      };
    }
    const params = rule.params || {};
    switch (rule.ruleType) {
      case EligibilityRuleType.ENERGY_TYPE: {
        const need = params.energyType;
        if (!profile.energyType) {
          status = EligibilityStatus.UNRESOLVED;
          reasons.push(EligibilityReasonCode.MISSING_REQUIRED_FACT);
        } else if (profile.energyType !== need) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.ENERGY_TYPE_MISMATCH],
          };
        }
        break;
      }
      case EligibilityRuleType.CUSTOMER_SEGMENT: {
        if (params.segment && params.segment !== segment) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.CUSTOMER_SEGMENT_MISMATCH],
          };
        }
        break;
      }
      case EligibilityRuleType.CONSUMPTION_MIN_KWH: {
        if (profile.annualConsumptionKwh == null) {
          status = EligibilityStatus.UNRESOLVED;
          reasons.push(EligibilityReasonCode.MISSING_REQUIRED_FACT);
        } else if (BigInt(profile.annualConsumptionKwh) < BigInt(params.minKwh)) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.CONSUMPTION_BELOW_MIN],
          };
        }
        break;
      }
      case EligibilityRuleType.CONSUMPTION_MAX_KWH: {
        if (profile.annualConsumptionKwh == null) {
          status = EligibilityStatus.UNRESOLVED;
          reasons.push(EligibilityReasonCode.MISSING_REQUIRED_FACT);
        } else if (BigInt(profile.annualConsumptionKwh) > BigInt(params.maxKwh)) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.CONSUMPTION_ABOVE_MAX],
          };
        }
        break;
      }
      case EligibilityRuleType.POSTCODE_ALLOWLIST: {
        const list = Array.isArray(params.postcodes) ? params.postcodes.map(String) : [];
        if (!profile.postcode) {
          status = EligibilityStatus.UNRESOLVED;
          reasons.push(EligibilityReasonCode.MISSING_REQUIRED_FACT);
        } else if (!list.includes(String(profile.postcode))) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.POSTCODE_NOT_SUPPORTED],
          };
        }
        break;
      }
      case EligibilityRuleType.POSTCODE_PREFIX_ALLOWLIST: {
        const prefixes = Array.isArray(params.prefixes) ? params.prefixes.map(String) : [];
        if (!profile.postcode) {
          status = EligibilityStatus.UNRESOLVED;
          reasons.push(EligibilityReasonCode.MISSING_REQUIRED_FACT);
        } else if (!prefixes.some((p) => String(profile.postcode).startsWith(p))) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.POSTCODE_NOT_SUPPORTED],
          };
        }
        break;
      }
      case EligibilityRuleType.METERING_TYPE_REQUIRED: {
        const need = params.meteringType;
        if (!profile.meteringType) {
          status = EligibilityStatus.UNRESOLVED;
          reasons.push(EligibilityReasonCode.METERING_TYPE_REQUIRED);
        } else if (need && profile.meteringType !== need) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.METERING_TYPE_MISMATCH],
          };
        }
        break;
      }
      case EligibilityRuleType.SUPPLY_POINT_MIN: {
        if (profile.supplyPointCount < Number(params.min)) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.SUPPLY_POINT_RULE_MISMATCH],
          };
        }
        break;
      }
      case EligibilityRuleType.SUPPLY_POINT_MAX: {
        if (profile.supplyPointCount > Number(params.max)) {
          return {
            eligibilityStatus: EligibilityStatus.INELIGIBLE,
            reasonCodes: [EligibilityReasonCode.SUPPLY_POINT_RULE_MISMATCH],
          };
        }
        break;
      }
      default:
        return {
          eligibilityStatus: EligibilityStatus.UNRESOLVED,
          reasonCodes: [EligibilityReasonCode.UNKNOWN_RULE_TYPE],
        };
    }
  }

  if (status === EligibilityStatus.UNRESOLVED) {
    return {
      eligibilityStatus: EligibilityStatus.UNRESOLVED,
      reasonCodes: [...new Set(reasons)],
    };
  }
  return { eligibilityStatus: EligibilityStatus.ELIGIBLE, reasonCodes: [] };
}
