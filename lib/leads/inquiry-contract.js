/**
 * Shared inquiry contract for the browser and the API.
 * The client may send inquiry_type as data. It does not choose storage,
 * mail recipients, or the captcha action.
 */

export const INQUIRY_TYPES = Object.freeze([
  'private_energy',
  'business_energy',
  'partner',
  'general',
])

export const PAGE_SOURCE_INQUIRY = 'inquiry'

const TYPE_SET = new Set(INQUIRY_TYPES)

export const INQUIRY_SUBJECT = Object.freeze({
  private_energy: 'Privatanfrage',
  business_energy: 'Gewerbeanfrage',
  partner: 'Partneranfrage',
  general: 'allgemeine Anfrage',
})

export function isInquiryType(value) {
  return typeof value === 'string' && TYPE_SET.has(value)
}

/** True when the body is the unified intake shape, including malformed attempts. */
export function isUnifiedInquiryRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  if (raw.page_source === PAGE_SOURCE_INQUIRY) return true
  return typeof raw.inquiry_type === 'string' && raw.inquiry_type.length > 0
}

export function inquirySubjectLabel(type) {
  return INQUIRY_SUBJECT[type] || ''
}

/** Where the row is written. Partner stays on the existing career table. */
export function inquiryStorageKind(type) {
  return type === 'partner' ? 'career' : 'leads'
}

/**
 * Stored page_source buckets so existing admin/deletion filters keep working.
 * The request page_source stays `inquiry` for the captcha binding.
 */
export function storedPageSource(type) {
  if (type === 'private_energy') return 'privat'
  if (type === 'business_energy') return 'unternehmen'
  if (type === 'general') return 'general'
  if (type === 'partner') return 'career'
  return ''
}

export function leadRefPrefix(type) {
  if (type === 'private_energy') return 'privat'
  if (type === 'business_energy') return 'unternehmen'
  if (type === 'partner') return 'partner'
  if (type === 'general') return 'general'
  return 'inquiry'
}

const MAILED = new Set(['accepted', 'internal_sent'])

export function mailStatusSucceeded(status) {
  return typeof status === 'string' && MAILED.has(status)
}

/**
 * Documented backend success: row stored AND internal mail accepted.
 * HTTP 202, ok:false, or mail:false is never success.
 */
export function isDocumentedInquirySuccess(status, json) {
  return (
    status === 200 &&
    json?.ok === true &&
    json?.stored === true &&
    json?.mail === true &&
    mailStatusSucceeded(json?.mailStatus)
  )
}
