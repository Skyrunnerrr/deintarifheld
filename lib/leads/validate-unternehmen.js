const MAX = {
  firma: 160,
  ansprechpartner: 120,
  email: 180,
  telefon: 40,
  plz: 5,
  energieart: 40,
  verbrauchStrom: 40,
  verbrauchGas: 40,
  standorte: 40,
  versorger: 120,
  vertragslaufzeit: 80,
  nachricht: 2000,
  source_page: 200,
  honeypot: 200,
}

function str(value, max) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function exceedsMax(value, max) {
  return typeof value === 'string' && value.trim().length > max
}

function validEmail(value) {
  return value.length >= 3 && value.length <= MAX.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function truthyConsent(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'on'
}

/**
 * Validate unternehmen / B2B payload.
 * @returns {{ ok: true, data: object } | { ok: false, code: string }}
 */
export function validateUnternehmenPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'invalid-payload' }
  }

  if (raw.page_source != null && raw.page_source !== 'unternehmen') {
    return { ok: false, code: 'unsupported-page-source' }
  }

  const honeypotFilled =
    str(raw.website_url, MAX.honeypot).length > 0 ||
    str(raw.company_fax, MAX.honeypot).length > 0 ||
    str(raw.companyWebsite, MAX.honeypot).length > 0

  if (
    exceedsMax(raw.firma, MAX.firma) ||
    exceedsMax(raw.ansprechpartner, MAX.ansprechpartner) ||
    exceedsMax(raw.email, MAX.email) ||
    exceedsMax(raw.telefon, MAX.telefon) ||
    exceedsMax(raw.nachricht, MAX.nachricht) ||
    exceedsMax(raw.versorger, MAX.versorger) ||
    exceedsMax(raw.source_page, MAX.source_page)
  ) {
    return { ok: false, code: 'invalid-message' }
  }

  const firma = str(raw.firma, MAX.firma)
  const ansprechpartner = str(raw.ansprechpartner, MAX.ansprechpartner)
  const email = str(raw.email, MAX.email).toLowerCase()
  const telefon = str(raw.telefon, MAX.telefon)
  const plz = str(raw.plz, MAX.plz)
  const energieart = str(raw.energieart, MAX.energieart)
  const verbrauchStrom = str(raw.verbrauchStrom, MAX.verbrauchStrom)
  const verbrauchGas = str(raw.verbrauchGas, MAX.verbrauchGas)
  const standorte = str(raw.standorte, MAX.standorte)
  const versorger = str(raw.versorger, MAX.versorger)
  const vertragslaufzeit = str(raw.vertragslaufzeit, MAX.vertragslaufzeit)
  const nachricht = str(raw.nachricht, MAX.nachricht)
  const sourcePage = str(raw.source_page || raw.sourcePage, MAX.source_page) || '/unternehmen-neu/'

  if (!truthyConsent(raw.dsgvo) && !truthyConsent(raw.privacyAccepted)) {
    return { ok: false, code: 'privacy-required' }
  }

  if (firma.length < 2 || ansprechpartner.length < 2 || !validEmail(email)) {
    return { ok: false, code: 'invalid-name-email' }
  }

  if (plz && !/^\d{5}$/.test(plz)) {
    return { ok: false, code: 'invalid-plz' }
  }

  return {
    ok: true,
    honeypotFilled,
    data: {
      page_source: 'unternehmen',
      lead_type: 'business_energy',
      firma,
      ansprechpartner,
      email,
      telefon,
      plz,
      energieart,
      verbrauchStrom,
      verbrauchGas,
      standorte,
      versorger,
      vertragslaufzeit,
      nachricht,
      source_page: sourcePage,
      dsgvo: true,
      form_version: str(String(raw.form_version || '2.0'), 20),
      _formLoadedAt: raw._formLoadedAt ?? raw.formStartedAt ?? null,
    },
  }
}
