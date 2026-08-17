/**
 * DTH-A7 Energy + Tariff Domain contracts.
 * Tariff evaluation domain kill maps to KillDomain.AUTOMATION_ENGINE
 * (frozen 8-domain registry — no 9th KillDomain). A1 job execution already
 * gates on AUTOMATION_ENGINE; A7 prepare/run uses the same domain gate.
 * LIVE_TARIFF_PROVIDER_CALLS=0 LIVE_SUPPLIER_API_CALLS=0 LIVE_AI_CALLS_A7=0.
 */

import { ENERGY_TARIFF_EVALUATION_PREPARE_HANDOFF } from './a6-document-contracts.js';
import { CanonicalEnergyType } from './a3-qualification-contracts.js';

/** Capability / job type — alias of A6 handoff string. */
export const ENERGY_TARIFF_EVALUATION_PREPARE_CAPABILITY =
  ENERGY_TARIFF_EVALUATION_PREPARE_HANDOFF;

/** A8 handoff constant only — do not implement A8 offer engine here. */
export const OFFER_PREPARE_HANDOFF = 'OFFER_PREPARE';

export const A7_CALCULATION_POLICY_ID = 'TariffCalculationPolicyV1';
export const A7_CALCULATION_POLICY_VERSION = 1;
export const A7_RANKING_POLICY_ID = 'TariffRankingPolicyV1';
export const A7_RANKING_POLICY_VERSION = 1;
export const A7_EXTRACTOR_ID = 'dth_a7_tariff_engine_v1';
export const A7_EXTRACTOR_VERSION = '1.0.0';
export const A7_ELIGIBILITY_POLICY_ID = 'TariffEligibilityPolicyV1';
export const A7_ELIGIBILITY_POLICY_VERSION = 1;

/** 1 EUR = 1_000_000 micro-EUR. Unit prices are microEUR per kWh (integer). */
export const MICRO_EUR_SCALE = 1_000_000;

export const LIVE_TARIFF_PROVIDER_CALLS = 0;
export const LIVE_SUPPLIER_API_CALLS = 0;
export const LIVE_AI_CALLS_A7 = 0;

export const TariffStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DRAFT: 'DRAFT',
  SUPERSEDED: 'SUPERSEDED',
});

/** Align with A3 CanonicalEnergyType. */
export const EnergyType = Object.freeze({
  ELECTRICITY: CanonicalEnergyType.ELECTRICITY,
  GAS: CanonicalEnergyType.GAS,
});

export const CustomerSegment = Object.freeze({
  BUSINESS: 'BUSINESS',
  PRIVATE: 'PRIVATE',
});

export const PriceBasis = Object.freeze({
  NET: 'NET',
  GROSS: 'GROSS',
});

export const ComponentType = Object.freeze({
  ENERGY_VARIABLE: 'ENERGY_VARIABLE',
  BASE_FIXED: 'BASE_FIXED',
  METER_FIXED: 'METER_FIXED',
  SITE_FIXED: 'SITE_FIXED',
  BONUS: 'BONUS',
  DISCOUNT: 'DISCOUNT',
  SURCHARGE: 'SURCHARGE',
  TAX_COMPONENT: 'TAX_COMPONENT',
  OTHER_FIXED: 'OTHER_FIXED',
  OTHER_VARIABLE: 'OTHER_VARIABLE',
});

export const ComponentFrequency = Object.freeze({
  PER_YEAR: 'PER_YEAR',
  PER_MONTH: 'PER_MONTH',
  PER_DAY: 'PER_DAY',
  ONE_TIME: 'ONE_TIME',
  PER_KWH: 'PER_KWH',
});

export const ComponentAppliesTo = Object.freeze({
  FIRST_YEAR: 'first_year',
  ONGOING: 'ongoing',
  BOTH: 'both',
});

export const EligibilityStatus = Object.freeze({
  ELIGIBLE: 'ELIGIBLE',
  INELIGIBLE: 'INELIGIBLE',
  UNRESOLVED: 'UNRESOLVED',
});

export const EvaluationReadiness = Object.freeze({
  READY_FOR_OFFER: 'READY_FOR_OFFER',
  PARTIAL_RESULTS: 'PARTIAL_RESULTS',
  INPUT_REQUIRED: 'INPUT_REQUIRED',
  CONFLICT_REVIEW_REQUIRED: 'CONFLICT_REVIEW_REQUIRED',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  NO_ELIGIBLE_TARIFF: 'NO_ELIGIBLE_TARIFF',
  CATALOGUE_UNAVAILABLE: 'CATALOGUE_UNAVAILABLE',
  BLOCKED: 'BLOCKED',
});

export const EvaluationStatus = Object.freeze({
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
});

export const EligibilityReasonCode = Object.freeze({
  ENERGY_TYPE_MISMATCH: 'ENERGY_TYPE_MISMATCH',
  CUSTOMER_SEGMENT_MISMATCH: 'CUSTOMER_SEGMENT_MISMATCH',
  CONSUMPTION_BELOW_MIN: 'CONSUMPTION_BELOW_MIN',
  CONSUMPTION_ABOVE_MAX: 'CONSUMPTION_ABOVE_MAX',
  POSTCODE_NOT_SUPPORTED: 'POSTCODE_NOT_SUPPORTED',
  METERING_TYPE_REQUIRED: 'METERING_TYPE_REQUIRED',
  METERING_TYPE_MISMATCH: 'METERING_TYPE_MISMATCH',
  SUPPLY_POINT_RULE_MISMATCH: 'SUPPLY_POINT_RULE_MISMATCH',
  TARIFF_NOT_EFFECTIVE: 'TARIFF_NOT_EFFECTIVE',
  TARIFF_INACTIVE: 'TARIFF_INACTIVE',
  TARIFF_EXPIRED: 'TARIFF_EXPIRED',
  TARIFF_FUTURE: 'TARIFF_FUTURE',
  MISSING_REQUIRED_FACT: 'MISSING_REQUIRED_FACT',
  INPUT_CONFLICT: 'INPUT_CONFLICT',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  PRICE_BASIS_MISMATCH: 'PRICE_BASIS_MISMATCH',
  UNKNOWN_COMPONENT_TYPE: 'UNKNOWN_COMPONENT_TYPE',
  UNKNOWN_RULE_TYPE: 'UNKNOWN_RULE_TYPE',
  CATALOGUE_EMPTY: 'CATALOGUE_EMPTY',
  PROFILE_NOT_READY: 'PROFILE_NOT_READY',
});

/** Known eligibility rule_type values — data only, never executable. */
export const EligibilityRuleType = Object.freeze({
  ENERGY_TYPE: 'ENERGY_TYPE',
  CUSTOMER_SEGMENT: 'CUSTOMER_SEGMENT',
  CONSUMPTION_MIN_KWH: 'CONSUMPTION_MIN_KWH',
  CONSUMPTION_MAX_KWH: 'CONSUMPTION_MAX_KWH',
  POSTCODE_ALLOWLIST: 'POSTCODE_ALLOWLIST',
  POSTCODE_PREFIX_ALLOWLIST: 'POSTCODE_PREFIX_ALLOWLIST',
  METERING_TYPE_REQUIRED: 'METERING_TYPE_REQUIRED',
  SUPPLY_POINT_MIN: 'SUPPLY_POINT_MIN',
  SUPPLY_POINT_MAX: 'SUPPLY_POINT_MAX',
});

export const TariffSourceKind = Object.freeze({
  TEST_FIXTURE: 'TEST_FIXTURE',
});

export const ProfileReadiness = Object.freeze({
  READY: 'READY',
  PARTIAL: 'PARTIAL',
  CONFLICT_REVIEW_REQUIRED: 'CONFLICT_REVIEW_REQUIRED',
  INPUT_REQUIRED: 'INPUT_REQUIRED',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
});

export const BaselineSource = Object.freeze({
  DOCUMENT_FACT: 'DOCUMENT_FACT',
  LEAD_PAYLOAD: 'LEAD_PAYLOAD',
  NONE: 'NONE',
});

/** Owner decisions unresolved — production live source / ranking / business rules. */
export const OWNER_LIVE_TARIFF_SOURCE_REQUIRED = true;
export const OWNER_TARIFF_RANKING_POLICY_REQUIRED = true;
export const OWNER_ENERGY_BUSINESS_RULE_REQUIRED = true;
export const OWNER_VAT_TAX_POLICY_REQUIRED = true;
export const OWNER_TARIFF_IMPORT_PROVIDER_REQUIRED = true;
export const OWNER_COMMISSION_DATA_POLICY_REQUIRED = true;

/** Documented kill mapping — not a 9th domain. */
export const TariffKillDomain = 'AUTOMATION_ENGINE';
