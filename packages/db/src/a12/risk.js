/**
 * Content risk classification from validated claims + brand.
 */
import { ContentRiskClass, ClaimState, ClaimType } from '@deintarifheld/shared';

export function classifyContentRisk({ claims = [], brandOk = true, highRiskSupported = false } = {}) {
  if (!brandOk) return { riskClass: ContentRiskClass.BLOCKED, reason: 'BRAND_FAIL' };
  if (claims.some((c) => c.claimState === ClaimState.PROHIBITED || c.riskClass === 'BLOCKED')) {
    return { riskClass: ContentRiskClass.BLOCKED, reason: 'PROHIBITED_CLAIM' };
  }
  if (claims.some((c) => c.claimState === ClaimState.UNSUPPORTED)) {
    return { riskClass: ContentRiskClass.BLOCKED, reason: 'UNSUPPORTED_CLAIM' };
  }
  const highTypes = new Set([
    ClaimType.SAVINGS,
    ClaimType.TARIFF_AS_LIVE,
    ClaimType.TESTIMONIAL,
    ClaimType.SUPERLATIVE,
    ClaimType.LEGAL,
  ]);
  if (claims.some((c) => highTypes.has(c.claimType) || c.riskClass === 'HIGH')) {
    if (highRiskSupported && claims.every((c) => c.claimState === ClaimState.SUPPORTED || c.claimState === ClaimState.REVIEW_REQUIRED)) {
      return { riskClass: ContentRiskClass.HIGH, reason: 'HIGH_RISK_SUPPORTED' };
    }
    return { riskClass: ContentRiskClass.HIGH, reason: 'HIGH_CLAIM_TYPE' };
  }
  if (claims.some((c) => c.claimState === ClaimState.REVIEW_REQUIRED || c.claimState === ClaimState.UNKNOWN)) {
    return { riskClass: ContentRiskClass.MEDIUM, reason: 'REVIEW_REQUIRED' };
  }
  return { riskClass: ContentRiskClass.LOW, reason: 'SAFE_EDUCATION' };
}
