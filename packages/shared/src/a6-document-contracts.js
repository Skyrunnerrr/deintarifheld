/**
 * DTH-A6 Document Intelligence contracts.
 * Document processing maps to KillDomain.DATA_IMPORT (frozen 8-domain registry).
 * A1 job execution still gates on AUTOMATION_ENGINE.
 * LIVE_DOCUMENT_STORAGE_PROVIDER_CALLS=0 LIVE_OCR=0 LIVE_AI=0 LIVE_EMAIL=0 for E2.
 */

export const A6_DOCUMENT_POLICY_ID = 'DocumentIntelligencePolicyV1';
export const A6_DOCUMENT_POLICY_VERSION = 1;

export const A6_EXTRACTOR_ID = 'dth_deterministic_pdf_v1';
export const A6_EXTRACTOR_VERSION = '1.0.0';
export const A6_CLASSIFIER_ID = 'dth_keyword_classifier_v1';
export const A6_CLASSIFIER_VERSION = '1.0.0';

/** Hard cap for E2 test uploads (2 MB). */
export const TEST_MAX_DOCUMENT_BYTES = 2_000_000;

/** Max persisted extracted text length. */
export const TEST_MAX_EXTRACTED_TEXT_CHARS = 50_000;

export const LIVE_DOCUMENT_STORAGE_PROVIDER_CALLS = 0;
export const LIVE_OCR_PROVIDER_CALLS = 0;
export const LIVE_AI_CALLS_A6 = 0;

/** A1 capabilities */
export const DOCUMENT_INTELLIGENCE_PREPARE_CAPABILITY = 'DOCUMENT_INTELLIGENCE_PREPARE';
export const DOCUMENT_PROCESS_CAPABILITY = 'DOCUMENT_PROCESS';

/** A7 handoff constant — prepare only; no tariff/savings logic in A6. */
export const ENERGY_TARIFF_EVALUATION_PREPARE_HANDOFF = 'ENERGY_TARIFF_EVALUATION_PREPARE';

export const DocumentSourceKind = Object.freeze({
  TEST_UPLOAD: 'TEST_UPLOAD',
  A4_INBOUND_ATTACHMENT: 'A4_INBOUND_ATTACHMENT',
});

export const DocumentStatus = Object.freeze({
  RECEIVED: 'RECEIVED',
  VALIDATING: 'VALIDATING',
  REJECTED: 'REJECTED',
  STORED: 'STORED',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  AMBIGUOUS: 'AMBIGUOUS',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  FAILED: 'FAILED',
  SUPERSEDED: 'SUPERSEDED',
  DELETED: 'DELETED',
});

export const DocumentType = Object.freeze({
  ELECTRICITY_INVOICE: 'ELECTRICITY_INVOICE',
  GAS_INVOICE: 'GAS_INVOICE',
  ENERGY_SUPPLY_CONTRACT: 'ENERGY_SUPPLY_CONTRACT',
  CONTRACT_CONFIRMATION: 'CONTRACT_CONFIRMATION',
  METER_INFORMATION: 'METER_INFORMATION',
  OTHER_ENERGY_DOCUMENT: 'OTHER_ENERGY_DOCUMENT',
  UNKNOWN_DOCUMENT: 'UNKNOWN_DOCUMENT',
});

export const OcrStatus = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  REQUIRED: 'REQUIRED',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  FAILED: 'FAILED',
  COMPLETED: 'COMPLETED',
});

export const DocumentFactStatus = Object.freeze({
  CANDIDATE: 'CANDIDATE',
  ACCEPTED: 'ACCEPTED',
  AMBIGUOUS: 'AMBIGUOUS',
  CONFLICTING: 'CONFLICTING',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
  HUMAN_VERIFIED: 'HUMAN_VERIFIED',
});

export const ConfidenceClass = Object.freeze({
  EXACT_LABEL_MATCH: 'EXACT_LABEL_MATCH',
  STRUCTURAL_MATCH: 'STRUCTURAL_MATCH',
  HEURISTIC: 'HEURISTIC',
  AMBIGUOUS: 'AMBIGUOUS',
});

/** Alias — some modules historically used FactConfidenceClass. */
export const FactConfidenceClass = ConfidenceClass;

export const FactValueType = Object.freeze({
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  DECIMAL: 'DECIMAL',
  DATE: 'DATE',
  IDENTIFIER: 'IDENTIFIER',
  ENUM: 'ENUM',
});

export const DocumentFactCode = Object.freeze({
  ENERGY_TYPE: 'ENERGY_TYPE',
  ANNUAL_CONSUMPTION_KWH: 'ANNUAL_CONSUMPTION_KWH',
  SUPPLIER_NAME: 'SUPPLIER_NAME',
  METER_NUMBER: 'METER_NUMBER',
  MALO_ID: 'MALO_ID',
  MELO_ID: 'MELO_ID',
  PLZ: 'PLZ',
  CONTRACT_START_DATE: 'CONTRACT_START_DATE',
  CONTRACT_END_DATE: 'CONTRACT_END_DATE',
});

/** @deprecated use ANNUAL_CONSUMPTION_KWH */
export const CONSUMPTION_KWH_ALIAS = DocumentFactCode.ANNUAL_CONSUMPTION_KWH;

export const DocumentFactsReadiness = Object.freeze({
  DOCUMENT_FACTS_READY: 'DOCUMENT_FACTS_READY',
  DOCUMENT_FACTS_PARTIAL: 'DOCUMENT_FACTS_PARTIAL',
  DOCUMENT_REVIEW_REQUIRED: 'DOCUMENT_REVIEW_REQUIRED',
  NO_DOCUMENTS: 'NO_DOCUMENTS',
});

/** Owner decisions unresolved for production — E2 uses local test storage only. */
export const OWNER_DOCUMENT_STORAGE_PROVIDER_REQUIRED = true;
export const OWNER_OCR_PROVIDER_DECISION_REQUIRED = true;
export const OWNER_DOCUMENT_RETENTION_POLICY_REQUIRED = true;
export const OWNER_CUSTOMER_UPLOAD_UI_DECISION_REQUIRED = true;
export const OWNER_DOCUMENT_REQUEST_COMMUNICATION_REQUIRED = true;
export const OWNER_MALWARE_SCANNER_PROVIDER_REQUIRED = true;

export const DocumentKillDomain = 'DATA_IMPORT';
