/**
 * Technical consent helpers. No legal-basis claims.
 * ProvenExpert network script loads only after provenexpert === true.
 */

export const CONSENT_STORAGE_KEY = 'th_consent'
export const PROVENEXPERT_SCRIPT_URL = 'https://s.provenexpert.net/seals/proseal-v2.js'
export const PROVENEXPERT_SCRIPT_HOST = 's.provenexpert.net'
export const CONSENT_CHANGED_EVENT = 'dth-consent-changed'

export function parseStoredConsent(raw) {
  if (raw == null || raw === '') {
    return { essential: false, provenexpert: false }
  }
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { essential: false, provenexpert: false }
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { essential: false, provenexpert: false }
  }
  return {
    essential: parsed.essential === true,
    provenexpert: parsed.provenexpert === true,
  }
}

/** Essential-only (or missing/invalid consent) → do not inject the PE network script. */
export function shouldLoadProvenExpertScript(rawConsent) {
  return parseStoredConsent(rawConsent).provenexpert === true
}

export function essentialOnlyConsent(now = Date.now()) {
  return { essential: true, provenexpert: false, timestamp: now }
}

export function acceptOptionalProvenExpertConsent(now = Date.now()) {
  return { essential: true, provenexpert: true, timestamp: now }
}
