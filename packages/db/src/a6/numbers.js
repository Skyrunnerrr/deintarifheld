/**
 * Document-locale number parsing.
 * A3 intake forbids dots/commas; invoices often use German thousands separators
 * when unit kWh is explicit — that is stronger evidence than free-form intake.
 */
import { parseConsumptionKwh } from '../a3/normalize.js';

/**
 * Parse consumption from document context.
 * Supported high-confidence:
 * - digit-only (delegates to A3)
 * - German thousands: 50.000 kWh / 50 000 kWh / 50.000
 * Ambiguous:
 * - 50,000 without clear locale
 * - decimals 50,5 / 50.5 without unit policy
 */
export function parseDocumentConsumptionKwh(raw, { unitHint = null } = {}) {
  const s = String(raw || '').trim();
  if (!s) return { status: 'MISSING', valueKwh: null, raw: s };

  // Strip explicit unit
  const stripped = s.replace(/\s*(kWh|MWh)\s*$/i, '').trim();
  const isMwh = /MWh/i.test(s) || String(unitHint || '').toLowerCase() === 'mwh';
  const unitExplicit =
    /kWh|MWh/i.test(s)
    || ['kwh', 'mwh'].includes(String(unitHint || '').toLowerCase());

  // Digit-only → A3 authority (kWh). Plain digits + MWh handled below.
  if (/^\d+$/.test(stripped) && !isMwh) {
    return parseConsumptionKwh(stripped);
  }

  // German thousands: 50.000 or 50.000.000
  if (/^\d{1,3}(\.\d{3})+$/.test(stripped) && unitExplicit) {
    let n = Number.parseInt(stripped.replace(/\./g, ''), 10);
    if (!Number.isSafeInteger(n) || n < 0) return { status: 'INVALID', valueKwh: null, raw: s };
    if (isMwh) n *= 1000;
    return { status: 'OK', valueKwh: n, raw: s, unit: 'kWh', locale: 'de-DE-document' };
  }

  // Space thousands: 50 000
  if (/^\d{1,3}( \d{3})+$/.test(stripped) && unitExplicit) {
    let n = Number.parseInt(stripped.replace(/ /g, ''), 10);
    if (!Number.isSafeInteger(n) || n < 0) return { status: 'INVALID', valueKwh: null, raw: s };
    if (isMwh) n *= 1000;
    return { status: 'OK', valueKwh: n, raw: s, unit: 'kWh', locale: 'spaced' };
  }

  // Plain digits + explicit MWh
  if (/^\d+$/.test(stripped) && isMwh) {
    const n = Number.parseInt(stripped, 10) * 1000;
    if (!Number.isSafeInteger(n) || n < 0) return { status: 'INVALID', valueKwh: null, raw: s };
    return { status: 'OK', valueKwh: n, raw: s, unit: 'kWh', locale: 'mwh-convert' };
  }

  // 50,000 — ambiguous US vs DE without more context
  if (/^\d{1,3}(,\d{3})+$/.test(stripped)) {
    return { status: 'AMBIGUOUS', valueKwh: null, raw: s };
  }

  // Decimals
  if (/[.,]\d+$/.test(stripped)) {
    return { status: 'AMBIGUOUS', valueKwh: null, raw: s };
  }

  return { status: 'AMBIGUOUS', valueKwh: null, raw: s };
}

/** Exact DD.MM.YYYY only — no invented dates from "12 Monate". */
export function parseExactGermanDate(raw) {
  const s = String(raw || '').trim();
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return { status: 'AMBIGUOUS', iso: null, raw: s };
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { status: 'INVALID', iso: null, raw: s };
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { status: 'OK', iso, raw: s };
}
