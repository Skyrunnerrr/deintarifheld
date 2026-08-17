/**
 * Deterministic labelled fact extraction from document text.
 * Prompt-injection text remains ordinary data — never authority.
 * Returns snake_case fields for persistence.
 */
import {
  DocumentFactCode,
  ConfidenceClass,
  DocumentFactStatus,
  A6_EXTRACTOR_VERSION,
} from '@deintarifheld/shared';
import { normalizeEnergyType, normalizePlz } from '../a3/normalize.js';
import { parseDocumentConsumptionKwh, parseExactGermanDate } from './numbers.js';

function pageFromNearby(text, index) {
  const before = text.slice(Math.max(0, index - 80), index);
  const m = /\[PAGE:(\d+)\]/.exec(before);
  return m ? Number(m[1]) : null;
}

function fact(partial) {
  return {
    value_type: 'TEXT',
    unit: null,
    status: DocumentFactStatus.ACCEPTED,
    confidence_class: ConfidenceClass.EXACT_LABEL_MATCH,
    extraction_method: 'LABELLED_FIELD',
    source_page: null,
    evidence_span: null,
    extractor_version: A6_EXTRACTOR_VERSION,
    ...partial,
  };
}

/**
 * @returns {Array<object>}
 */
export function extractFactsFromText(text, { documentType = null } = {}) {
  const t = String(text || '');
  const facts = [];
  if (!t.trim()) return facts;

  if (
    /Stromart|Energieart\s*:\s*Strom|\bStromrechnung\b|Strom\s+Rechnung|Elektrizit/i.test(t)
    || documentType === 'ELECTRICITY_INVOICE'
  ) {
    const n = normalizeEnergyType('Strom');
    if (n.status === 'OK') {
      facts.push(fact({
        fact_code: DocumentFactCode.ENERGY_TYPE,
        value_type: 'ENUM',
        raw_value: 'Strom',
        normalized_value: n.canonical,
        extraction_method: 'LABEL_KEYWORD',
        evidence_span: 'Strom',
      }));
    }
  } else if (
    /\bGasrechnung\b|Gas\s+Rechnung|Energieart\s*:\s*Gas|\bErdgas\b/i.test(t)
    || documentType === 'GAS_INVOICE'
  ) {
    const n = normalizeEnergyType('Gas');
    if (n.status === 'OK') {
      facts.push(fact({
        fact_code: DocumentFactCode.ENERGY_TYPE,
        value_type: 'ENUM',
        raw_value: 'Gas',
        normalized_value: n.canonical,
        extraction_method: 'LABEL_KEYWORD',
        evidence_span: 'Gas',
      }));
    }
  }

  // Multi-location: capture each labelled site block separately
  const siteRe = /Standort\s*(\d+)\s*:\s*PLZ\s*(\d{5})(?:.*?Verbrauch\s*:\s*([0-9.\s,]+)\s*kWh)?/gi;
  let sm;
  let siteCount = 0;
  while ((sm = siteRe.exec(t)) !== null) {
    siteCount += 1;
    const plzN = normalizePlz(sm[2]);
    facts.push(fact({
      fact_code: DocumentFactCode.PLZ,
      value_type: 'IDENTIFIER',
      raw_value: sm[2],
      normalized_value: plzN.ok ? sm[2] : null,
      status: plzN.ok ? DocumentFactStatus.ACCEPTED : DocumentFactStatus.AMBIGUOUS,
      confidence_class: plzN.ok ? ConfidenceClass.EXACT_LABEL_MATCH : ConfidenceClass.AMBIGUOUS,
      source_page: pageFromNearby(t, sm.index),
      evidence_span: sm[0].slice(0, 120),
    }));
    if (sm[3]) {
      const parsed = parseDocumentConsumptionKwh(`${sm[3]} kWh`, { unitHint: 'kWh' });
      facts.push(fact({
        fact_code: DocumentFactCode.ANNUAL_CONSUMPTION_KWH,
        value_type: 'INTEGER',
        raw_value: sm[0],
        normalized_value: parsed.valueKwh != null ? String(parsed.valueKwh) : null,
        unit: 'kWh',
        status: parsed.status === 'OK'
          ? DocumentFactStatus.ACCEPTED
          : (parsed.status === 'AMBIGUOUS' ? DocumentFactStatus.AMBIGUOUS : DocumentFactStatus.REJECTED),
        confidence_class: parsed.status === 'OK' ? ConfidenceClass.EXACT_LABEL_MATCH : ConfidenceClass.AMBIGUOUS,
        source_page: pageFromNearby(t, sm.index),
        evidence_span: sm[0].slice(0, 120),
      }));
    }
  }

  if (siteCount === 0) {
    const consRe = /(?:Jahresverbrauch|Verbrauch)\s*:\s*([0-9.\s,]+)\s*(kWh|MWh)?/gi;
    let m;
    while ((m = consRe.exec(t)) !== null) {
      const unit = m[2] || 'kWh';
      const parsed = parseDocumentConsumptionKwh(`${m[1]} ${unit}`.trim(), { unitHint: unit });
      // MWh without explicit conversion policy → ambiguous (no invented kWh)
      if (/^MWh$/i.test(unit) && parsed.status !== 'OK') {
        facts.push(fact({
          fact_code: DocumentFactCode.ANNUAL_CONSUMPTION_KWH,
          value_type: 'INTEGER',
          raw_value: m[0],
          normalized_value: null,
          unit,
          status: DocumentFactStatus.AMBIGUOUS,
          confidence_class: ConfidenceClass.AMBIGUOUS,
          source_page: pageFromNearby(t, m.index),
          evidence_span: m[0].slice(0, 120),
        }));
        continue;
      }
      facts.push(fact({
        fact_code: DocumentFactCode.ANNUAL_CONSUMPTION_KWH,
        value_type: 'INTEGER',
        raw_value: m[0],
        normalized_value: parsed.valueKwh != null ? String(parsed.valueKwh) : null,
        unit: parsed.unit || 'kWh',
        status: parsed.status === 'OK'
          ? DocumentFactStatus.ACCEPTED
          : (parsed.status === 'AMBIGUOUS' ? DocumentFactStatus.AMBIGUOUS : DocumentFactStatus.REJECTED),
        confidence_class: parsed.status === 'OK' ? ConfidenceClass.EXACT_LABEL_MATCH : ConfidenceClass.AMBIGUOUS,
        source_page: pageFromNearby(t, m.index),
        evidence_span: m[0].slice(0, 120),
      }));
    }
  }

  const sup = /(?:Lieferant|Versorger|Anbieter)\s*:\s*([^\n\r]+?)(?=\s+(?:Zählernummer|MaLo|MeLo|PLZ|Vertrag|Verbrauch|Jahresverbrauch)|$)/i.exec(t)
    || /(?:Lieferant|Versorger|Anbieter)\s*:\s*([A-Za-zÄÖÜäöüß0-9 .&\-]{2,80})/i.exec(t);
  if (sup) {
    facts.push(fact({
      fact_code: DocumentFactCode.SUPPLIER_NAME,
      value_type: 'TEXT',
      raw_value: sup[1].trim(),
      normalized_value: sup[1].trim().replace(/\s+/g, ' ').slice(0, 200),
      source_page: pageFromNearby(t, t.indexOf(sup[0])),
      evidence_span: sup[0].slice(0, 120),
    }));
  }

  const meter = /Zählernummer\s*:\s*([A-Za-z0-9\-]+)/i.exec(t);
  if (meter) {
    facts.push(fact({
      fact_code: DocumentFactCode.METER_NUMBER,
      value_type: 'IDENTIFIER',
      raw_value: meter[1],
      normalized_value: meter[1],
      source_page: pageFromNearby(t, t.indexOf(meter[0])),
      evidence_span: meter[0].slice(0, 120),
    }));
  }
  const malo = /MaLo(?:-ID)?\s*:\s*([A-Za-z0-9\-]+)/i.exec(t);
  if (malo) {
    facts.push(fact({
      fact_code: DocumentFactCode.MALO_ID,
      value_type: 'IDENTIFIER',
      raw_value: malo[1],
      normalized_value: malo[1],
      source_page: pageFromNearby(t, t.indexOf(malo[0])),
      evidence_span: malo[0].slice(0, 120),
    }));
  }
  const melo = /MeLo(?:-ID)?\s*:\s*([A-Za-z0-9\-]+)/i.exec(t);
  if (melo) {
    facts.push(fact({
      fact_code: DocumentFactCode.MELO_ID,
      value_type: 'IDENTIFIER',
      raw_value: melo[1],
      normalized_value: melo[1],
      source_page: pageFromNearby(t, t.indexOf(melo[0])),
      evidence_span: melo[0].slice(0, 120),
    }));
  }

  if (siteCount === 0) {
    const plz = /PLZ\s*:\s*(\d{5})/i.exec(t);
    if (plz) {
      const n = normalizePlz(plz[1]);
      facts.push(fact({
        fact_code: DocumentFactCode.PLZ,
        value_type: 'IDENTIFIER',
        raw_value: plz[1],
        normalized_value: n.ok ? plz[1] : null,
        status: n.ok ? DocumentFactStatus.ACCEPTED : DocumentFactStatus.AMBIGUOUS,
        confidence_class: n.ok ? ConfidenceClass.EXACT_LABEL_MATCH : ConfidenceClass.AMBIGUOUS,
        source_page: pageFromNearby(t, t.indexOf(plz[0])),
        evidence_span: plz[0],
      }));
    }
  }

  const start = /(?:Vertragsbeginn|Vertrag\s+Beginn)\s*:\s*(\d{2}\.\d{2}\.\d{4})/i.exec(t);
  if (start) {
    const d = parseExactGermanDate(start[1]);
    facts.push(fact({
      fact_code: DocumentFactCode.CONTRACT_START_DATE,
      value_type: 'DATE',
      raw_value: start[1],
      normalized_value: d.iso,
      status: d.status === 'OK' ? DocumentFactStatus.ACCEPTED : DocumentFactStatus.AMBIGUOUS,
      confidence_class: d.status === 'OK' ? ConfidenceClass.EXACT_LABEL_MATCH : ConfidenceClass.AMBIGUOUS,
      source_page: pageFromNearby(t, t.indexOf(start[0])),
      evidence_span: start[0],
    }));
  }
  const end = /(?:Vertragsende|Vertrag\s+Ende)\s*:\s*(\d{2}\.\d{2}\.\d{4})/i.exec(t);
  if (end) {
    const d = parseExactGermanDate(end[1]);
    facts.push(fact({
      fact_code: DocumentFactCode.CONTRACT_END_DATE,
      value_type: 'DATE',
      raw_value: end[1],
      normalized_value: d.iso,
      status: d.status === 'OK' ? DocumentFactStatus.ACCEPTED : DocumentFactStatus.AMBIGUOUS,
      confidence_class: d.status === 'OK' ? ConfidenceClass.EXACT_LABEL_MATCH : ConfidenceClass.AMBIGUOUS,
      source_page: pageFromNearby(t, t.indexOf(end[0])),
      evidence_span: end[0],
    }));
  }

  // Vague term must NOT invent end date
  void (/Mindestvertragslaufzeit\s*:\s*12\s*Monate/i.test(t) && !end);

  return facts;
}

export { extractFactsFromText as extractEnergyFactsFromText };
