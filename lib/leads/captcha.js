import { isProductionRuntime } from './runtime-env.js'
import { actionMatchesExpectation, isActionBasedExpectation } from './captcha-action.js'

export { CAPTCHA_PRODUCTION_VARIANT, resolveExpectedCaptchaAction } from './captcha-action.js'

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
const DEFAULT_MIN_SCORE = 0.5
const DEFAULT_HOSTS = ['deintarifheld.de', 'www.deintarifheld.de']

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

export function recaptchaAllowedHostnames() {
  const extra = String(process.env.RECAPTCHA_ALLOWED_HOSTNAMES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...DEFAULT_HOSTS, ...extra])
}

function isV3Response(data) {
  return typeof data?.score === 'number' || typeof data?.action === 'string'
}

function hostnameAllowed(hostname) {
  if (typeof hostname !== 'string' || !hostname) return false
  return recaptchaAllowedHostnames().has(hostname.trim().toLowerCase())
}

/**
 * Standard reCAPTCHA v2/v3 via classic siteverify only.
 * Enterprise tokens are not a supported production variant.
 *
 * v3 (score and/or action present): action must exactly match the server-owned
 * expectation when one is provided; missing action → reject. Score must meet
 * RECAPTCHA_MIN_SCORE. Hostname must match the allowlist when present;
 * production rejects a missing hostname.
 * v2 checkbox (no score, no action): action/score checks are N/A.
 */
export async function verifyCaptchaToken(
  token,
  { remoteip, expectedAction, allowedActions, fetchImpl } = {},
) {
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

  const v3 = isV3Response(data)
  const actionBased = isActionBasedExpectation({ expectedAction, allowedActions })

  if (v3) {
    if (typeof data.score !== 'number') {
      return { ok: false, code: 'captcha-rejected' }
    }
    const min = Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_MIN_SCORE)
    if (data.score < min) return { ok: false, code: 'captcha-rejected' }
    if (actionBased) {
      if (typeof data.action !== 'string' || !data.action) {
        return { ok: false, code: 'captcha-rejected' }
      }
      if (!actionMatchesExpectation(data.action, { expectedAction, allowedActions })) {
        return { ok: false, code: 'captcha-rejected' }
      }
    }
  }

  if (typeof data.hostname === 'string' && data.hostname) {
    if (!hostnameAllowed(data.hostname)) {
      return { ok: false, code: 'captcha-rejected' }
    }
  } else if (isProductionRuntime()) {
    return { ok: false, code: 'captcha-rejected' }
  }

  return { ok: true, hostname: data.hostname || null, score: data.score ?? null, action: data.action || null }
}
