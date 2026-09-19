import { isProductionRuntime } from './runtime-env.js'
import { actionMatchesExpectation, isActionBasedExpectation, isValidGoogleV3Action } from './captcha-action.js'

export { CAPTCHA_PRODUCTION_VARIANT, resolveExpectedCaptchaAction } from './captcha-action.js'

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
const DEFAULT_MIN_SCORE = 0.5
const DEFAULT_HOSTS = ['deintarifheld.de', 'www.deintarifheld.de']

const PUBLIC_CAPTCHA_CODES = new Set([
  'captcha-not-configured',
  'captcha-invalid',
  'captcha-verify-failed',
])

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

function safeAction(action) {
  if (typeof action !== 'string' || !action) return null
  return isValidGoogleV3Action(action) ? action : 'invalid'
}

/** Official Google siteverify error-code LABELS. Not secret/token values. */
export const GOOGLE_SITEVERIFY_ERROR_CODES = Object.freeze([
  'missing-input-secret',
  'invalid-input-secret',
  'missing-input-response',
  'invalid-input-response',
  'bad-request',
  'timeout-or-duplicate',
])

const GOOGLE_SITEVERIFY_ERROR_CODE_SET = new Set(GOOGLE_SITEVERIFY_ERROR_CODES)

function safeErrorCodes(data) {
  const raw = data?.['error-codes']
  if (!Array.isArray(raw)) return []
  return raw
    .filter((code) => typeof code === 'string' && GOOGLE_SITEVERIFY_ERROR_CODE_SET.has(code))
    .slice(0, 8)
}

/**
 * Safe operational diagnostics from Google siteverify. Never includes token/secret/IP/PII.
 */
export function captchaDiagnosticsFromSiteverify(data = {}) {
  return {
    success: data?.success === true,
    error_codes: safeErrorCodes(data),
    score: typeof data?.score === 'number' ? data.score : null,
    action: safeAction(data?.action),
    hostname: typeof data?.hostname === 'string' && data.hostname ? data.hostname : null,
  }
}

export function publicCaptchaErrorCode(result) {
  const code = result?.code
  if (PUBLIC_CAPTCHA_CODES.has(code)) return code
  return 'captcha-rejected'
}

function fail(reason, diagnostics = captchaDiagnosticsFromSiteverify(), publicCode) {
  const code = publicCode || (PUBLIC_CAPTCHA_CODES.has(reason) ? reason : 'captcha-rejected')
  return { ok: false, code, reason, diagnostics }
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
    return fail('captcha-not-configured', captchaDiagnosticsFromSiteverify())
  }
  if (typeof token !== 'string' || token.length < 20 || token.length > 4000) {
    return fail('captcha-invalid', captchaDiagnosticsFromSiteverify(), 'captcha-invalid')
  }

  const fetchFn = fetchImpl || globalThis.fetch
  if (typeof fetchFn !== 'function') {
    return fail('captcha-verify-failed', captchaDiagnosticsFromSiteverify())
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
    return fail('captcha-verify-failed', captchaDiagnosticsFromSiteverify())
  }

  if (!res || !res.ok) {
    return fail('captcha-verify-failed', captchaDiagnosticsFromSiteverify())
  }

  let data
  try {
    data = await res.json()
  } catch {
    return fail('captcha-verify-failed', captchaDiagnosticsFromSiteverify())
  }

  const diagnostics = captchaDiagnosticsFromSiteverify(data)

  if (!data || data.success !== true) {
    return fail('captcha-google-rejected', diagnostics)
  }

  const v3 = isV3Response(data)
  const actionBased = isActionBasedExpectation({ expectedAction, allowedActions })

  if (v3) {
    if (typeof data.score !== 'number') {
      return fail('captcha-google-rejected', diagnostics)
    }
    const min = Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_MIN_SCORE)
    if (data.score < min) return fail('captcha-score-too-low', diagnostics)
    if (actionBased) {
      if (typeof data.action !== 'string' || !data.action) {
        return fail('captcha-action-mismatch', diagnostics)
      }
      if (!actionMatchesExpectation(data.action, { expectedAction, allowedActions })) {
        return fail('captcha-action-mismatch', diagnostics)
      }
    }
  }

  if (typeof data.hostname === 'string' && data.hostname) {
    if (!hostnameAllowed(data.hostname)) {
      return fail('captcha-hostname-mismatch', diagnostics)
    }
  } else if (isProductionRuntime()) {
    return fail('captcha-hostname-mismatch', diagnostics)
  }

  return {
    ok: true,
    hostname: data.hostname || null,
    score: data.score ?? null,
    action: data.action || null,
    reason: null,
    diagnostics,
  }
}
