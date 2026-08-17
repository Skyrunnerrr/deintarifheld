/**
 * B2BQualificationPolicyV1 — CALL_READY only (not OFFER_READY).
 * Evidence: BusinessForm.jsx + validate-unternehmen.js + Owner CALL_READY direction.
 */
import {
  A3_POLICY_ID,
  A3_POLICY_VERSION,
  CanonicalEnergyType,
  FieldCode,
  FieldRequirementClass,
  QualificationOutcome,
  ReasonCode,
} from '@deintarifheld/shared';
import { createHash } from 'node:crypto';

export const B2B_QUALIFICATION_POLICY_V1 = Object.freeze({
  policy_id: A3_POLICY_ID,
  policy_version: A3_POLICY_VERSION,
  scope: 'INITIAL_B2B_CALL_READINESS',
  fields: Object.freeze({
    [FieldCode.FIRMA]: FieldRequirementClass.REQUIRED_FOR_CALL_READINESS,
    [FieldCode.ANSPRECHPARTNER]: FieldRequirementClass.REQUIRED_FOR_CALL_READINESS,
    [FieldCode.EMAIL]: FieldRequirementClass.REQUIRED_FOR_CALL_READINESS,
    [FieldCode.ENERGIEART]: FieldRequirementClass.REQUIRED_FOR_CALL_READINESS,
    [FieldCode.VERBRAUCH_STROM]: FieldRequirementClass.REQUIRED_FOR_CALL_READINESS, // conditional
    [FieldCode.VERBRAUCH_GAS]: FieldRequirementClass.REQUIRED_FOR_CALL_READINESS, // conditional
    [FieldCode.STANDORTE]: FieldRequirementClass.REQUIRED_FOR_CALL_READINESS,
    [FieldCode.TELEFON]: FieldRequirementClass.USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL,
    [FieldCode.PLZ]: FieldRequirementClass.USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL,
    [FieldCode.VERSORGER]: FieldRequirementClass.USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL,
    [FieldCode.VERTRAGSLAUFZEIT]: FieldRequirementClass.USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL,
    [FieldCode.NACHRICHT]: FieldRequirementClass.LATER_STAGE_REQUIRED, // never authority
  }),
});

function req(field_code, reason_code, requirement_code) {
  return {
    field_code,
    reason_code,
    requirement_code: requirement_code || `${field_code}:${reason_code}`,
    required_for: 'CALL_READINESS',
  };
}

/**
 * Deterministic CALL_READY evaluation from normalized facts.
 */
export function evaluateCallReadiness(normalized) {
  const missing = [];
  const ambiguous = [];
  const contradictions = [];
  let blockingReviewReason = null;

  if (!normalized.firma?.present) {
    missing.push(req(FieldCode.FIRMA, ReasonCode.REQUIRED_VALUE_MISSING));
  }
  if (!normalized.ansprechpartner?.present) {
    missing.push(req(FieldCode.ANSPRECHPARTNER, ReasonCode.REQUIRED_VALUE_MISSING));
  }
  if (!normalized.email?.contactability_ok) {
    missing.push(req(FieldCode.EMAIL, ReasonCode.CONTACTABILITY_MISSING));
  }

  const energy = normalized.energieart;
  if (!energy || energy.status === 'MISSING') {
    missing.push(req(FieldCode.ENERGIEART, ReasonCode.REQUIRED_VALUE_MISSING, 'energieart:MISSING'));
  } else if (energy.status === 'UNKNOWN') {
    ambiguous.push(req(FieldCode.ENERGIEART, ReasonCode.ENERGY_TYPE_UNKNOWN));
    blockingReviewReason = ReasonCode.ENERGY_TYPE_UNKNOWN;
  }

  const needStrom = energy?.canonical === CanonicalEnergyType.ELECTRICITY;
  const needGas = energy?.canonical === CanonicalEnergyType.GAS;

  if (needStrom) {
    const s = normalized.verbrauchStrom;
    if (!s || s.status === 'MISSING') {
      missing.push(req(FieldCode.VERBRAUCH_STROM, ReasonCode.RELEVANT_CONSUMPTION_MISSING));
    } else if (s.status === 'AMBIGUOUS') {
      ambiguous.push(req(FieldCode.VERBRAUCH_STROM, ReasonCode.AMBIGUOUS_NUMBER));
      blockingReviewReason = blockingReviewReason || ReasonCode.AMBIGUOUS_NUMBER;
    } else if (s.status === 'INVALID') {
      ambiguous.push(req(FieldCode.VERBRAUCH_STROM, ReasonCode.INVALID_NUMBER));
      blockingReviewReason = blockingReviewReason || ReasonCode.INVALID_NUMBER;
    }
  }
  if (needGas) {
    const g = normalized.verbrauchGas;
    if (!g || g.status === 'MISSING') {
      missing.push(req(FieldCode.VERBRAUCH_GAS, ReasonCode.RELEVANT_CONSUMPTION_MISSING));
    } else if (g.status === 'AMBIGUOUS') {
      ambiguous.push(req(FieldCode.VERBRAUCH_GAS, ReasonCode.AMBIGUOUS_NUMBER));
      blockingReviewReason = blockingReviewReason || ReasonCode.AMBIGUOUS_NUMBER;
    } else if (g.status === 'INVALID') {
      ambiguous.push(req(FieldCode.VERBRAUCH_GAS, ReasonCode.INVALID_NUMBER));
      blockingReviewReason = blockingReviewReason || ReasonCode.INVALID_NUMBER;
    }
  }

  // Irrelevant consumption with value while energy known opposite — soft contradiction for review
  if (needStrom && normalized.verbrauchGas?.status === 'OK' && normalized.verbrauchStrom?.status === 'OK') {
    // both present is fine for electricity-only UI (gas field hidden) — ignore
  }
  if (
    energy?.status === 'OK' &&
    needStrom &&
    normalized.verbrauchGas?.status === 'OK' &&
    (!normalized.verbrauchStrom || normalized.verbrauchStrom.status === 'MISSING')
  ) {
    // Gas filled but electricity required and missing — already missing strom; no extra contradiction
  }

  const sites = normalized.standorte;
  if (!sites || sites.status === 'MISSING') {
    missing.push(req(FieldCode.STANDORTE, ReasonCode.SITE_COUNT_MISSING));
  } else if (sites.status === 'AMBIGUOUS') {
    ambiguous.push(req(FieldCode.STANDORTE, ReasonCode.SITE_COUNT_AMBIGUOUS));
    blockingReviewReason = blockingReviewReason || ReasonCode.SITE_COUNT_AMBIGUOUS;
  }

  let outcome;
  if (blockingReviewReason || ambiguous.length > 0) {
    outcome = QualificationOutcome.NEEDS_HUMAN_REVIEW;
  } else if (missing.length > 0) {
    outcome = QualificationOutcome.MISSING_INFORMATION;
  } else {
    outcome = QualificationOutcome.QUALIFIED_FOR_CALL;
  }

  return {
    outcome,
    missing_requirements: missing,
    ambiguous_requirements: ambiguous,
    contradictions,
    blocking_reason: blockingReviewReason,
    policy_id: A3_POLICY_ID,
    policy_version: A3_POLICY_VERSION,
  };
}

/**
 * Fingerprint over canonical qualification inputs (no volatile timestamps).
 */
export function computeInputFingerprint({ normalized, energyCanonical, overlays }) {
  const payload = {
    policy: `${A3_POLICY_ID}:${A3_POLICY_VERSION}`,
    energy: energyCanonical || null,
    firma: Boolean(normalized.firma?.present),
    contact: Boolean(normalized.ansprechpartner?.present),
    email_ok: Boolean(normalized.email?.contactability_ok),
    strom: normalized.verbrauchStrom?.status === 'OK' ? normalized.verbrauchStrom.valueKwh : normalized.verbrauchStrom?.status,
    gas: normalized.verbrauchGas?.status === 'OK' ? normalized.verbrauchGas.valueKwh : normalized.verbrauchGas?.status,
    sites: normalized.standorte?.status === 'OK' ? normalized.standorte.canonical?.code : normalized.standorte?.status,
    overlays: overlays || [],
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
