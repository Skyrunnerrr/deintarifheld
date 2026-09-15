import { createHmac } from 'crypto'
import { ANONYMISED_EMAIL, REDACTED_EMAIL } from './deletion-state.js'
import { CANONICAL_DELETION_MODES, isDeletionMode, resolveDeletionMode } from './deletion-mode.js'

export { ANONYMISED_EMAIL, REDACTED_EMAIL, CANONICAL_DELETION_MODES, isDeletionMode, resolveDeletionMode }
/** Canonical modes only. `anonymise` is a deprecated alias for `redact`. */
export const DELETION_MODES = CANONICAL_DELETION_MODES

const PII_PAYLOAD_KEYS = new Set([
  'email',
  'full_name',
  'name',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'phone',
  'telefon',
  'tel',
  'mobile',
  'ansprechpartner',
  'nachricht',
  'motivation',
  'message',
  'messages',
  'note',
  'notes',
  'kommentar',
])

export function auditEmailHashSalt() {
  return process.env.AUDIT_EMAIL_HASH_SALT?.trim() || ''
}

/**
 * Pseudonymous identifier for delete audits. Never store plaintext email.
 * Uses AUDIT_EMAIL_HASH_SALT (separate from rate-limit / session salts).
 */
export function emailAuditPseudonym(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) {
    return { email_hmac: null, email_present: false, salt_configured: Boolean(auditEmailHashSalt()) }
  }
  const salt = auditEmailHashSalt()
  if (!salt) {
    return { email_hmac: null, email_present: true, salt_configured: false }
  }
  return {
    email_hmac: createHmac('sha256', salt).update(normalized).digest('hex'),
    email_present: true,
    salt_configured: true,
  }
}

function looksLikeIdentityKey(key) {
  const k = String(key || '').toLowerCase()
  return k.includes('email') || k.includes('phone') || k.includes('telefon') || k.endsWith('name')
}

/**
 * Redact / minimise identity, contact, and message PII from a stored payload.
 * This is not legal anonymisation. `firma` may be kept for business ops
 * correlation; that state is redacted / minimised, not anonymous.
 */
export function redactPayload(payload, { keepFirma = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const out = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith('_')) continue
    if (PII_PAYLOAD_KEYS.has(key)) continue
    if (looksLikeIdentityKey(key)) continue
    if (key === 'firma') {
      if (keepFirma && value != null && value !== '') out.firma = value
      continue
    }
    out[key] = value
  }
  return out
}

/** Historic name for redactPayload. */
export function anonymisePayload(payload, opts) {
  return redactPayload(payload, opts)
}
