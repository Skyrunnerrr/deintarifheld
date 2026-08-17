/**
 * Deterministic document classification — no LLM.
 */
import { DocumentType } from '@deintarifheld/shared';

export function classifyDocumentText(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) {
    return {
      documentType: DocumentType.UNKNOWN_DOCUMENT,
      method: 'EMPTY_TEXT',
      confidenceClass: 'AMBIGUOUS',
    };
  }

  const hasRechnung = /rechnung|invoice|abrechnung/.test(t);
  const hasVertrag = /liefervertrag|stromvertrag|gasvertrag|energieliefervertrag|Vertragsbeginn/i.test(text);
  const hasStrom = /strom|elektrizit|electricity|kwh/.test(t) && !/gas\b/.test(t);
  const hasGas = /\bgas\b|erdgas/.test(t);
  const hasMeter = /zählernummer|malo|melo|zählpunkt/.test(t);

  if (hasRechnung && hasStrom && !hasGas) {
    return { documentType: DocumentType.ELECTRICITY_INVOICE, method: 'KEYWORD', confidenceClass: 'EXACT_LABEL_MATCH' };
  }
  if (hasRechnung && hasGas) {
    return { documentType: DocumentType.GAS_INVOICE, method: 'KEYWORD', confidenceClass: 'EXACT_LABEL_MATCH' };
  }
  if (hasVertrag) {
    return { documentType: DocumentType.ENERGY_SUPPLY_CONTRACT, method: 'KEYWORD', confidenceClass: 'STRUCTURAL_MATCH' };
  }
  if (hasMeter && !hasRechnung) {
    return { documentType: DocumentType.METER_INFORMATION, method: 'KEYWORD', confidenceClass: 'STRUCTURAL_MATCH' };
  }
  if (hasRechnung) {
    return { documentType: DocumentType.OTHER_ENERGY_DOCUMENT, method: 'KEYWORD', confidenceClass: 'HEURISTIC' };
  }
  return {
    documentType: DocumentType.UNKNOWN_DOCUMENT,
    method: 'UNKNOWN',
    confidenceClass: 'AMBIGUOUS',
  };
}
