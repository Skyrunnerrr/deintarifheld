const MAX = {
  firstName: 120,
  email: 180,
  phone: 40,
  provider: 120,
  usage: 40,
  zip: 5,
  type: 40,
  source_page: 200,
  honeypot: 200,
}

const PRIVATE_SOURCES = new Set(['privat', 'hero-funnel', 'main_funnel'])

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
 * Validate private energy lead payloads (Hero / Funnel / page_source=privat).
 */
export function validatePrivatePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'invalid-payload' }
  }

  const pageSource = str(raw.page_source, 40) || 'privat'
  if (!PRIVATE_SOURCES.has(pageSource)) {
    return { ok: false, code: 'unsupported-page-source' }
  }

  const honeypotFilled =
    str(raw.website_url, MAX.honeypot).length > 0 ||
    str(raw.company_fax, MAX.honeypot).length > 0 ||
    str(raw.companyWebsite, MAX.honeypot).length > 0 ||
    str(raw.fax_number, MAX.honeypot).length > 0

  const firstName = str(raw.firstName || raw.name, MAX.firstName)
  const email = str(raw.email, MAX.email).toLowerCase()
  const phone = str(raw.phone || raw.telefon, MAX.phone)
  const provider = str(raw.provider || raw.versorger, MAX.provider)
  const usage = str(raw.usage || raw.consumption || raw.verbrauch, MAX.usage)
  const zip = str(raw.zip || raw.plz, MAX.zip)
  const energyType = str(raw.type || raw.energieart, MAX.type)
  const sourcePage = str(raw.source_page || raw.sourcePage || raw.page, MAX.source_page) || '/'

  if (
    exceedsMax(raw.firstName, MAX.firstName) ||
    exceedsMax(raw.email, MAX.email) ||
    exceedsMax(raw.phone, MAX.phone) ||
    exceedsMax(raw.provider, MAX.provider)
  ) {
    return { ok: false, code: 'invalid-message' }
  }

  if (!truthyConsent(raw.gdpr) && !truthyConsent(raw.dsgvo) && !truthyConsent(raw.privacyAccepted)) {
    return { ok: false, code: 'privacy-required' }
  }

  if (firstName.length < 2 || !validEmail(email)) {
    return { ok: false, code: 'invalid-name-email' }
  }

  if (zip && !/^\d{5}$/.test(zip)) {
    return { ok: false, code: 'invalid-plz' }
  }

  return {
    ok: true,
    honeypotFilled,
    data: {
      page_source: pageSource,
      lead_type: 'private_energy',
      firstName,
      email,
      phone,
      provider,
      usage,
      zip,
      type: energyType,
      source_page: sourcePage,
      dsgvo: true,
      form_version: str(String(raw.form_version || '2.0'), 20),
      _formLoadedAt: raw._formLoadedAt ?? raw.formStartedAt ?? null,
    },
  }
}

export function isPrivatePageSource(value) {
  return PRIVATE_SOURCES.has(String(value || '').trim())
}
