const MAX = {
  name: 160,
  email: 180,
  phone: 40,
  motivation: 4000,
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
 * Text-only career application validation.
 * File/CV uploads are intentionally rejected (separate architecture required).
 */
export function validateCareerPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'invalid-payload' }
  }

  if (raw.page_source != null && raw.page_source !== 'career') {
    return { ok: false, code: 'unsupported-page-source' }
  }

  if (raw.cv || raw.resume || raw.file || raw.files || raw.attachment) {
    return { ok: false, code: 'file-upload-not-supported' }
  }

  const honeypotFilled =
    str(raw.website_url, MAX.honeypot).length > 0 ||
    str(raw.company_fax, MAX.honeypot).length > 0 ||
    str(raw.companyWebsite, MAX.honeypot).length > 0

  if (
    exceedsMax(raw.name, MAX.name) ||
    exceedsMax(raw.email, MAX.email) ||
    exceedsMax(raw.phone, MAX.phone) ||
    exceedsMax(raw.motivation, MAX.motivation)
  ) {
    return { ok: false, code: 'invalid-message' }
  }

  const name = str(raw.name, MAX.name)
  const email = str(raw.email, MAX.email).toLowerCase()
  const phone = str(raw.phone || raw.telefon, MAX.phone)
  const motivation = str(raw.motivation || raw.nachricht, MAX.motivation)
  const sourcePage = str(raw.source_page || raw.sourcePage, MAX.source_page) || '/karriere/'

  if (!truthyConsent(raw.gdpr) && !truthyConsent(raw.dsgvo) && !truthyConsent(raw.privacyAccepted)) {
    return { ok: false, code: 'privacy-required' }
  }

  if (name.length < 2 || !validEmail(email)) {
    return { ok: false, code: 'invalid-name-email' }
  }

  return {
    ok: true,
    honeypotFilled,
    data: {
      page_source: 'career',
      name,
      email,
      phone,
      motivation,
      source_page: sourcePage,
      dsgvo: true,
      form_version: str(String(raw.form_version || '2.0'), 20),
      _formLoadedAt: raw._formLoadedAt ?? raw.formStartedAt ?? null,
    },
  }
}
