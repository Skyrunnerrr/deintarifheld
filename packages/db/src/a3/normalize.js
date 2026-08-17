/**
 * A3 bounded deterministic normalization.
 * Ambiguous values stay AMBIGUOUS — never invent numbers/dates.
 */
import { CanonicalEnergyType, FieldCode } from '@deintarifheld/shared';

const ENERGY_MAP = Object.freeze({
  Strom: CanonicalEnergyType.ELECTRICITY,
  Gas: CanonicalEnergyType.GAS,
});

/** Exact UI options from BusinessForm.jsx (en-dash in 2–5). */
const SITE_MAP = Object.freeze({
  '1': { code: 'ONE', min: 1, max: 1 },
  '2–5': { code: 'TWO_TO_FIVE', min: 2, max: 5 },
  '6+': { code: 'SIX_PLUS', min: 6, max: null },
});

function trimStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Strict consumption parser.
 * Supported: optional spaces + digit-only integer string (kWh implied by form label).
 * Ambiguous (must NOT invent): 10,5 / 10.5 / 10.000 / 10,000 / units embedded.
 */
export function parseConsumptionKwh(raw) {
  const s = trimStr(raw);
  if (!s) {
    return { status: 'MISSING', valueKwh: null, raw: s };
  }
  if (/[.,]/.test(s) || /[a-zA-Z]/.test(s)) {
    return { status: 'AMBIGUOUS', valueKwh: null, raw: s };
  }
  if (!/^\d+$/.test(s)) {
    return { status: 'INVALID', valueKwh: null, raw: s };
  }
  // Bound absurd lengths; still integer
  if (s.length > 12) {
    return { status: 'AMBIGUOUS', valueKwh: null, raw: s };
  }
  const n = Number.parseInt(s, 10);
  if (!Number.isSafeInteger(n) || n < 0) {
    return { status: 'INVALID', valueKwh: null, raw: s };
  }
  return { status: 'OK', valueKwh: n, raw: s, unit: 'kWh' };
}

export function normalizeEnergyType(raw) {
  const s = trimStr(raw);
  if (!s) return { status: 'MISSING', canonical: null, raw: s };
  const canonical = ENERGY_MAP[s];
  if (!canonical) return { status: 'UNKNOWN', canonical: null, raw: s };
  return { status: 'OK', canonical, raw: s };
}

export function normalizeStandorte(raw) {
  const s = trimStr(raw);
  if (!s) return { status: 'MISSING', canonical: null, raw: s };
  // Accept ASCII hyphen alias only as AMBIGUOUS (form uses en-dash)
  if (s === '2-5') {
    return { status: 'AMBIGUOUS', canonical: null, raw: s };
  }
  const mapped = SITE_MAP[s];
  if (!mapped) return { status: 'AMBIGUOUS', canonical: null, raw: s };
  return { status: 'OK', canonical: mapped, raw: s };
}

export function normalizePlz(raw) {
  const s = trimStr(raw);
  if (!s) return { status: 'MISSING', raw: s, ok: false };
  if (!/^\d{5}$/.test(s)) return { status: 'INVALID', raw: s, ok: false };
  return { status: 'OK', raw: s, ok: true };
}

/**
 * Merge intake payload + observation overlays into a working field bag.
 * Observations win for allowlisted fields (direct customer correction contract).
 */
export function buildFieldBag({ lead, payload, observations }) {
  const bag = {
    [FieldCode.FIRMA]: lead?.firma ?? payload?.firma ?? '',
    [FieldCode.ANSPRECHPARTNER]: payload?.ansprechpartner ?? '',
    [FieldCode.EMAIL]: lead?.email ?? payload?.email ?? '',
    [FieldCode.TELEFON]: payload?.telefon ?? '',
    [FieldCode.PLZ]: payload?.plz ?? '',
    [FieldCode.ENERGIEART]: payload?.energieart ?? '',
    [FieldCode.VERBRAUCH_STROM]: payload?.verbrauchStrom ?? '',
    [FieldCode.VERBRAUCH_GAS]: payload?.verbrauchGas ?? '',
    [FieldCode.STANDORTE]: payload?.standorte ?? '',
    [FieldCode.VERSORGER]: payload?.versorger ?? '',
    [FieldCode.VERTRAGSLAUFZEIT]: payload?.vertragslaufzeit ?? '',
    [FieldCode.NACHRICHT]: payload?.nachricht ?? '',
  };
  const provenance = {};
  for (const key of Object.keys(bag)) {
    provenance[key] = {
      source_kind: 'PUBLIC_INTAKE',
      source_ref: lead?.id ? `lead:${lead.id}` : null,
    };
  }
  // Latest observation per field (ordered by caller)
  for (const obs of observations || []) {
    if (!(obs.field_code in bag)) continue;
    bag[obs.field_code] = obs.value_text ?? '';
    provenance[obs.field_code] = {
      source_kind: obs.source_kind,
      source_ref: obs.source_ref || obs.idempotency_key,
    };
  }
  return { bag, provenance };
}

export function normalizeLeadFields(bag) {
  const energy = normalizeEnergyType(bag[FieldCode.ENERGIEART]);
  const strom = parseConsumptionKwh(bag[FieldCode.VERBRAUCH_STROM]);
  const gas = parseConsumptionKwh(bag[FieldCode.VERBRAUCH_GAS]);
  const sites = normalizeStandorte(bag[FieldCode.STANDORTE]);
  const plz = normalizePlz(bag[FieldCode.PLZ]);
  const firma = trimStr(bag[FieldCode.FIRMA]);
  const contact = trimStr(bag[FieldCode.ANSPRECHPARTNER]);
  const email = trimStr(bag[FieldCode.EMAIL]).toLowerCase();
  const telefon = trimStr(bag[FieldCode.TELEFON]);
  const versorger = trimStr(bag[FieldCode.VERSORGER]);
  const vertrag = trimStr(bag[FieldCode.VERTRAGSLAUFZEIT]);
  const notePresent = trimStr(bag[FieldCode.NACHRICHT]).length > 0;

  return {
    firma: { present: firma.length >= 2, length: firma.length },
    ansprechpartner: { present: contact.length >= 2, length: contact.length },
    email: {
      present: email.length >= 3 && email.includes('@'),
      contactability_ok: email.length >= 3 && email.includes('@'),
    },
    telefon: { present: telefon.length > 0 },
    plz,
    energieart: energy,
    verbrauchStrom: strom,
    verbrauchGas: gas,
    standorte: sites,
    versorger: {
      present: versorger.length > 0,
      status: versorger ? 'UNSTRUCTURED' : 'MISSING',
    },
    vertragslaufzeit: {
      present: vertrag.length > 0,
      status: vertrag ? 'UNSTRUCTURED' : 'MISSING',
    },
    nachricht: { unstructured_note_present: notePresent },
  };
}
