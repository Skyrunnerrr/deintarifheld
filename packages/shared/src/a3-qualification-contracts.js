/**
 * DTH-A3 B2B qualification contracts — CALL_READY scope only.
 * No client-selected outcomes/policies. No commercial scoring.
 */

export const A3_POLICY_ID = 'B2BQualificationPolicyV1';
export const A3_POLICY_VERSION = 1;
export const QUALIFICATION_SCOPE = 'INITIAL_B2B_CALL_READINESS';

export const B2B_QUALIFICATION_REEVALUATE_CAPABILITY = 'B2B_QUALIFICATION_REEVALUATE';

export const QualificationOutcome = Object.freeze({
  QUALIFIED_FOR_CALL: 'QUALIFIED_FOR_CALL',
  MISSING_INFORMATION: 'MISSING_INFORMATION',
  NEEDS_HUMAN_REVIEW: 'NEEDS_HUMAN_REVIEW',
  SOURCE_DATA_INVALID: 'SOURCE_DATA_INVALID',
});

export const RequirementStatus = Object.freeze({
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
});

export const ObservationSourceKind = Object.freeze({
  PUBLIC_INTAKE: 'PUBLIC_INTAKE',
  CUSTOMER_REPLY: 'CUSTOMER_REPLY',
  DOCUMENT_EXTRACTION: 'DOCUMENT_EXTRACTION',
  HUMAN_CORRECTION: 'HUMAN_CORRECTION',
  SYNTHETIC_TEST: 'SYNTHETIC_TEST',
});

export const FieldCode = Object.freeze({
  FIRMA: 'firma',
  ANSPRECHPARTNER: 'ansprechpartner',
  EMAIL: 'email',
  TELEFON: 'telefon',
  PLZ: 'plz',
  ENERGIEART: 'energieart',
  VERBRAUCH_STROM: 'verbrauchStrom',
  VERBRAUCH_GAS: 'verbrauchGas',
  STANDORTE: 'standorte',
  VERSORGER: 'versorger',
  VERTRAGSLAUFZEIT: 'vertragslaufzeit',
  NACHRICHT: 'nachricht',
});

/** Observation allowlist — unknown field_code rejected. */
export const OBSERVATION_FIELD_ALLOWLIST = Object.freeze([
  FieldCode.FIRMA,
  FieldCode.ANSPRECHPARTNER,
  FieldCode.EMAIL,
  FieldCode.TELEFON,
  FieldCode.PLZ,
  FieldCode.ENERGIEART,
  FieldCode.VERBRAUCH_STROM,
  FieldCode.VERBRAUCH_GAS,
  FieldCode.STANDORTE,
  FieldCode.VERSORGER,
  FieldCode.VERTRAGSLAUFZEIT,
]);

export const ReasonCode = Object.freeze({
  REQUIRED_VALUE_MISSING: 'REQUIRED_VALUE_MISSING',
  RELEVANT_CONSUMPTION_MISSING: 'RELEVANT_CONSUMPTION_MISSING',
  INVALID_NUMBER: 'INVALID_NUMBER',
  AMBIGUOUS_NUMBER: 'AMBIGUOUS_NUMBER',
  ENERGY_TYPE_UNKNOWN: 'ENERGY_TYPE_UNKNOWN',
  SITE_COUNT_MISSING: 'SITE_COUNT_MISSING',
  SITE_COUNT_AMBIGUOUS: 'SITE_COUNT_AMBIGUOUS',
  CONTRADICTORY_INPUT: 'CONTRADICTORY_INPUT',
  SOURCE_LEAD_MISSING: 'SOURCE_LEAD_MISSING',
  LINEAGE_INVALID: 'LINEAGE_INVALID',
  CONTACTABILITY_MISSING: 'CONTACTABILITY_MISSING',
});

export const FieldRequirementClass = Object.freeze({
  REQUIRED_FOR_CALL_READINESS: 'REQUIRED_FOR_CALL_READINESS',
  USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL: 'USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL',
  LATER_STAGE_REQUIRED: 'LATER_STAGE_REQUIRED',
});

export const CanonicalEnergyType = Object.freeze({
  ELECTRICITY: 'ELECTRICITY',
  GAS: 'GAS',
});

export const WorkflowQualState = Object.freeze({
  QUALIFIED_FOR_CALL: 'QUALIFIED_FOR_CALL',
  MISSING_INFO_COMMUNICATION_REQUIRED: 'MISSING_INFO_COMMUNICATION_REQUIRED',
  NEEDS_HUMAN_REVIEW: 'NEEDS_HUMAN_REVIEW',
  SOURCE_DATA_INVALID: 'SOURCE_DATA_INVALID',
});

export function isObservationFieldAllowed(fieldCode) {
  return OBSERVATION_FIELD_ALLOWLIST.includes(String(fieldCode || ''));
}

export function workflowStateForOutcome(outcome) {
  switch (outcome) {
    case QualificationOutcome.QUALIFIED_FOR_CALL:
      return WorkflowQualState.QUALIFIED_FOR_CALL;
    case QualificationOutcome.MISSING_INFORMATION:
      return WorkflowQualState.MISSING_INFO_COMMUNICATION_REQUIRED;
    case QualificationOutcome.NEEDS_HUMAN_REVIEW:
      return WorkflowQualState.NEEDS_HUMAN_REVIEW;
    case QualificationOutcome.SOURCE_DATA_INVALID:
      return WorkflowQualState.SOURCE_DATA_INVALID;
    default:
      return WorkflowQualState.NEEDS_HUMAN_REVIEW;
  }
}
