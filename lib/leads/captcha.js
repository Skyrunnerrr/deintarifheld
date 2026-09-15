import { isProductionRuntime } from './runtime-env.js'

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
const DEFAULT_MIN_SCORE = 0.5

export function recaptchaSecret() {
  return process.env.RECAPTCHA_SECRET_KEY?.trim() || ''
}

export function isCaptchaConfigured() {
  return recaptchaSecret().length > 0
}

/**
 * Production fail-closed when protection is configured OR when production has no secret.
 * Non-production: verify only when a secret is present (CI/local can stay token-free).
 */
export function captchaRequired() {
  if (isCaptchaConfigured()) return true
  return isProductionRuntime()
}

export async function verifyCaptchaToken(token, { remoteip, expectedAction, fetchImpl } = {}) {
  const secret = recaptchaSecret()
  if (!secret) {
    return { ok: false, code: 'captcha-not-configured' }
  }
  if (typeof token !== 'string' || token.length < 20 || token.length > 4000) {
    return { ok: false, code: 'captcha-invalid' }
  }

  const fetchFn = fetchImpl || globalThis.fetch
  if (typeof fetchFn !== 'function') {
    return { ok: false, code: 'captcha-verify-failed' }
  }

  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (remoteip && remoteip !== 'unknown') body.set('remoteip', remoteip)

  let res
  try {
    res = await fetchFn(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch {
    return { ok: false, code: 'captcha-verify-failed' }
  }

  if (!res || !res.ok) {
    return { ok: false, code: 'captcha-verify-failed' }
  }

  let data
  try {
    data = await res.json()
  } catch {
    return { ok: false, code: 'captcha-verify-failed' }
  }

  if (!data || data.success !== true) {
    return { ok: false, code: 'captcha-rejected' }
  }

  if (typeof data.score === 'number') {
    const min = Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_MIN_SCORE)
    if (data.score < min) return { ok: false, code: 'captcha-rejected' }
  }

  if (expectedAction && data.action && data.action !== expectedAction) {
    return { ok: false, code: 'captcha-rejected' }
  }

  if (isProductionRuntime() && data.hostname) {
    const host = String(data.hostname).toLowerCase()
    if (host !== 'deintarifheld.de' && host !== 'www.deintarifheld.de') {
      return { ok: false, code: 'captcha-rejected' }
    }
  }

  return { ok: true, hostname: data.hostname || null, score: data.score ?? null }
}
