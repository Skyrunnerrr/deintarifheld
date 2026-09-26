import { isInquiryType, PAGE_SOURCE_INQUIRY, storedPageSource } from './inquiry-contract.js'

const MAX = {
  name: 160,
  email: 180,
  phone: 40,
  plz: 5,
  verbrauch: 40,
  tarifinfo: 120,
  firma: 160,
  zaehler: 80,
  beschreibung: 500,
  motivation: 500,
  nachricht: 2000,
  source_page: 200,
  honeypot: 200,
  form_version: 20,
}

const ALLOWED_KEYS = new Set([
  'inquiry_type',
  'page_source',
  'name',
  'email',
  'phone',
  'plz',
  'verbrauch',
  'tarifinfo',
  'firma',
  'zaehler',
  'beschreibung',
  'motivation',
  'nachricht',
  'source_page',
  'form_version',
  'dsgvo',
  'gdpr',
  'privacyAccepted',
  '_formLoadedAt',
  'website_url',
  'company_fax',
  'companyWebsite',
  'fax_number',
  '_recaptchaToken',
  '_recaptchaAction',
])

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function str(value, max) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function exceedsMax(value, max) {
  return typeof value === 'string' && value.trim().length > max
}

function hasControlChars(value) {
  return typeof value === 'string' && /[\u0000-\u001F\u007F]/.test(value)
}

function truthyConsent(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'on'
}

function reject(code) {
  return { ok: false, code }
}

/**
 * Strict unified inquiry schema. Oversized and unknown fields are rejected.
 * Captcha tokens are never copied into the stored record.
 */
export function validateInquiryPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reject('invalid-payload')

  const keys = Object.keys(raw)
  if (keys.length > 40) return reject('invalid-payload')
  for (const key of keys) {
    if (!ALLOWED_KEYS.has(key)) return reject('invalid-payload')
  }

  if (raw.cv || raw.resume || raw.file || raw.files || raw.attachment) {
    return reject('file-upload-not-supported')
  }

  if (raw.page_source !== PAGE_SOURCE_INQUIRY) return reject('unsupported-page-source')
  if (!isInquiryType(raw.inquiry_type)) return reject('unsupported-inquiry-type')

  const stringKeys = [
    'name',
    'email',
    'phone',
    'plz',
    'verbrauch',
    'tarifinfo',
    'firma',
    'zaehler',
    'beschreibung',
    'motivation',
    'nachricht',
    'source_page',
    'form_version',
    'website_url',
    'company_fax',
    'companyWebsite',
    'fax_number',
    '_recaptchaAction',
  ]
  for (const key of stringKeys) {
    if (raw[key] == null || raw[key] === '') continue
    if (typeof raw[key] !== 'string') return reject('invalid-payload')
    if (hasControlChars(raw[key])) return reject('invalid-payload')
  }
  if (raw._recaptchaToken != null && typeof raw._recaptchaToken !== 'string') {
    return reject('invalid-payload')
  }
  if (
    raw._formLoadedAt != null &&
    typeof raw._formLoadedAt !== 'string' &&
    typeof raw._formLoadedAt !== 'number'
  ) {
    return reject('invalid-payload')
  }

  if (
    exceedsMax(raw.name, MAX.name) ||
    exceedsMax(raw.email, MAX.email) ||
    exceedsMax(raw.phone, MAX.phone) ||
    exceedsMax(raw.plz, MAX.plz) ||
    exceedsMax(raw.verbrauch, MAX.verbrauch) ||
    exceedsMax(raw.tarifinfo, MAX.tarifinfo) ||
    exceedsMax(raw.firma, MAX.firma) ||
    exceedsMax(raw.zaehler, MAX.zaehler) ||
    exceedsMax(raw.beschreibung, MAX.beschreibung) ||
    exceedsMax(raw.motivation, MAX.motivation) ||
    exceedsMax(raw.nachricht, MAX.nachricht) ||
    exceedsMax(raw.source_page, MAX.source_page)
  ) {
    return reject('invalid-message')
  }

  const honeypotFilled =
    str(raw.website_url, MAX.honeypot).length > 0 ||
    str(raw.company_fax, MAX.honeypot).length > 0 ||
    str(raw.companyWebsite, MAX.honeypot).length > 0 ||
    str(raw.fax_number, MAX.honeypot).length > 0

  const inquiryType = raw.inquiry_type
  const name = str(raw.name, MAX.name)
  const email = str(raw.email, MAX.email).toLowerCase()
  const phone = str(raw.phone, MAX.phone)
  const plz = str(raw.plz, MAX.plz)
  const verbrauch = str(raw.verbrauch, MAX.verbrauch)
  const tarifinfo = str(raw.tarifinfo, MAX.tarifinfo)
  const firma = str(raw.firma, MAX.firma)
  const zaehler = str(raw.zaehler, MAX.zaehler)
  const beschreibung = str(raw.beschreibung, MAX.beschreibung)
  const motivation = str(raw.motivation, MAX.motivation)
  const nachricht = str(raw.nachricht, MAX.nachricht)
  const sourcePage = str(raw.source_page, MAX.source_page) || '/'

  if (!truthyConsent(raw.dsgvo) && !truthyConsent(raw.gdpr) && !truthyConsent(raw.privacyAccepted)) {
    return reject('privacy-required')
  }
  if (name.length < 2 || !EMAIL_RE.test(email)) return reject('invalid-name-email')
  if (phone.length < 6) return reject('invalid-phone')

  if (inquiryType === 'private_energy' || inquiryType === 'business_energy') {
    if (!/^\d{5}$/.test(plz)) return reject('invalid-plz')
  }
  if (inquiryType === 'business_energy' && firma.length < 2) return reject('invalid-name-email')
  if (inquiryType === 'partner' && motivation.length < 10) return reject('invalid-message')
  if (inquiryType === 'general' && nachricht.length < 2) return reject('invalid-message')

  return {
    ok: true,
    honeypotFilled,
    data: {
      inquiry_type: inquiryType,
      page_source: storedPageSource(inquiryType),
      request_page_source: PAGE_SOURCE_INQUIRY,
      name,
      email,
      phone,
      plz,
      verbrauch,
      tarifinfo,
      firma,
      zaehler,
      beschreibung,
      motivation,
      nachricht,
      source_page: sourcePage,
      dsgvo: true,
      form_version: str(String(raw.form_version || '3.0'), MAX.form_version) || '3.0',
      _formLoadedAt: raw._formLoadedAt ?? null,
    },
  }
}
