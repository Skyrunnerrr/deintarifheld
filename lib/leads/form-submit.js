/**
 * Shared production-form submit helpers.
 * Fresh v3 tokens are minted immediately before POST. User-facing errors stay
 * truthful without exposing internal captcha/security diagnostics.
 */
import { getRecaptchaToken, hasVisibleRecaptchaSiteKey } from '../security.js'

const CAPTCHA_PUBLIC_CODES = new Set([
  'captcha-rejected',
  'captcha-invalid',
  'captcha-verify-failed',
  'captcha-not-configured',
  'captcha-action-unknown-context',
  'recaptcha-execute-unavailable',
  'recaptcha-token-empty',
  'recaptcha-client-failed',
  'recaptcha-ready-unavailable',
  'recaptcha-ready-timeout',
  'recaptcha-runtime-unavailable',
  'recaptcha-script-failed',
  'recaptcha-script-timeout',
  'recaptcha-execute-timeout',
  'recaptcha-execute-failed',
  'recaptcha-not-configured',
  'recaptcha-window-unavailable',
  'recaptcha-action-invalid',
  'recaptcha-script-mismatch',
])

const VALIDATION_CODES = new Set([
  'invalid-payload',
  'unsupported-page-source',
  'invalid-message',
  'privacy-required',
  'invalid-name-email',
  'invalid-phone',
  'provider-required',
  'invalid-usage',
  'invalid-energy-type',
  'locations-required',
  'motivation-required',
  'invalid-plz',
  'use-careers-endpoint',
  'file-upload-not-supported',
  'invalid-content-type',
])

const STORAGE_CODES = new Set([
  'storage-failed',
  'storage-not-configured',
])

const COPY = {
  informal: {
    captcha: 'Captcha konnte nicht bestätigt werden. Bitte lade die Seite neu und versuche es erneut.',
    rateLimited: 'Zu viele Anfragen. Bitte warte einen Moment und versuche es dann erneut.',
    validation: 'Bitte prüfe deine Angaben und versuche es erneut.',
    storage: 'Deine Anfrage konnte gerade nicht gespeichert werden. Bitte versuche es in wenigen Minuten erneut.',
    network: 'Absenden fehlgeschlagen. Bitte prüfe deine Verbindung und versuche es erneut.',
    generic: 'Absenden fehlgeschlagen. Bitte versuche es erneut.',
  },
  formal: {
    captcha: 'Captcha konnte nicht bestätigt werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
    rateLimited: 'Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.',
    validation: 'Bitte prüfen Sie Ihre Angaben und versuchen Sie es erneut.',
    storage: 'Ihre Anfrage konnte gerade nicht gespeichert werden. Bitte versuchen Sie es in wenigen Minuten erneut.',
    network: 'Absenden fehlgeschlagen. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
    generic: 'Absenden fehlgeschlagen. Bitte versuchen Sie es erneut.',
  },
}

export function isCaptchaPublicCode(code) {
  return typeof code === 'string' && CAPTCHA_PUBLIC_CODES.has(code)
}

export function isNetworkSubmitError(err) {
  if (!err) return false
  if (err.code === 'request-timeout' || err.name === 'AbortError') return true
  if (err.name === 'TypeError') return true
  const message = String(err.message || '')
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message)
}

function copyFor(tone) {
  return tone === 'formal' ? COPY.formal : COPY.informal
}

export function mapLeadSubmitUserMessage({ status, code, thrown } = {}, { tone = 'informal' } = {}) {
  const copy = copyFor(tone)
  if (isCaptchaPublicCode(code) || isCaptchaPublicCode(thrown?.code)) return copy.captcha
  if (code === 'too-many-requests' || status === 429) return copy.rateLimited
  if (status === 400 || VALIDATION_CODES.has(code)) return copy.validation
  if (status >= 500 || STORAGE_CODES.has(code)) return copy.storage
  if (thrown && isNetworkSubmitError(thrown)) return copy.network
  return copy.generic
}

export function leadSubmitCaptchaClientMessage(tone = 'informal') {
  return copyFor(tone).captcha
}

/**
 * Mint a fresh v3 token for the server-owned action. Never logs the token.
 * @returns {Promise<{ ok: true, token: string } | { ok: false, code: string }>}
 */
export async function awaitFreshRecaptchaToken(action) {
  if (typeof action !== 'string' || !action) {
    return { ok: false, code: 'recaptcha-action-invalid' }
  }
  try {
    const token = await getRecaptchaToken(action)
    if (typeof token !== 'string' || token.length < 20) {
      return { ok: false, code: 'recaptcha-token-empty' }
    }
    return { ok: true, token }
  } catch (err) {
    return { ok: false, code: err?.code || 'recaptcha-client-failed' }
  }
}

/**
 * One captcha token per submit. Visible v2 uses the solved widget token.
 * Enterprise v3 (production) mints a fresh execute() token immediately before POST.
 * Never sends both. Never logs the token.
 */
export async function resolveSubmitCaptchaToken(action, visibleToken) {
  if (hasVisibleRecaptchaSiteKey()) {
    if (typeof visibleToken === 'string' && visibleToken.length >= 20 && visibleToken.length <= 4000) {
      return { ok: true, token: visibleToken, mode: 'visible_v2' }
    }
    return { ok: false, code: 'recaptcha-token-empty', mode: 'visible_v2' }
  }
  const minted = await awaitFreshRecaptchaToken(action)
  return { ...minted, mode: 'v3' }
}
