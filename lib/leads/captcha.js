import { isProductionRuntime } from './runtime-env.js'
import { actionMatchesExpectation, isActionBasedExpectation, isValidGoogleV3Action } from './captcha-action.js'

export { CAPTCHA_PRODUCTION_VARIANT, resolveExpectedCaptchaAction } from './captcha-action.js'

const ASSESSMENT_HOST = 'https://recaptchaenterprise.googleapis.com'
const DEFAULT_MIN_SCORE = 0.5
const DEFAULT_VERIFY_TIMEOUT_MS = 5000
const DEFAULT_HOSTS = ['deintarifheld.de', 'www.deintarifheld.de']

const PUBLIC_CAPTCHA_CODES = new Set([
  'captcha-not-configured',
  'captcha-invalid',
  'captcha-verify-failed',
])

export function recaptchaProjectId() {
  return process.env.RECAPTCHA_PROJECT_ID?.trim() || ''
}

export function recaptchaApiKey() {
  return process.env.RECAPTCHA_API_KEY?.trim() || ''
}

export function recaptchaSiteKey() {
  return process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY?.trim() || ''
}

export function isCaptchaConfigured() {
  return recaptchaProjectId().length > 0 && recaptchaApiKey().length > 0 && recaptchaSiteKey().length > 0
}

/**
 * Production fail-closed when protection is configured OR when production has no
 * Enterprise Assessment credentials. Non-production: verify only when project,
 * API key, and site key are present (CI/local can stay token-free).
 * RECAPTCHA_SECRET_KEY is not load-bearing.
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

/**
 * Validated Enterprise risk threshold.
 * Invalid production configuration must never turn into NaN because every
 * comparison against NaN is false and would silently disable the score gate.
 */
export function recaptchaMinScore() {
  const raw = String(process.env.RECAPTCHA_MIN_SCORE ?? '').trim()
  if (!raw) return DEFAULT_MIN_SCORE
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) return null
  return value
}

export function recaptchaVerifyTimeoutMs() {
  const raw = String(process.env.RECAPTCHA_VERIFY_TIMEOUT_MS ?? '').trim()
  if (!raw) return DEFAULT_VERIFY_TIMEOUT_MS
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 100 || value > 15000) return null
  return value
}

function hostnameAllowed(hostname) {
  if (typeof hostname !== 'string' || !hostname) return false
  return recaptchaAllowedHostnames().has(hostname.trim().toLowerCase())
}

function safeAction(action) {
  if (typeof action !== 'string' || !action) return null
  return isValidGoogleV3Action(action) ? action : 'invalid'
}

/** Official Assessment tokenProperties.invalidReason labels. Not secrets/tokens. */
export const GOOGLE_ASSESSMENT_INVALID_REASONS = Object.freeze([
  'INVALID_REASON_UNSPECIFIED',
  'UNKNOWN_INVALID_REASON',
  'MALFORMED',
  'EXPIRED',
  'DUPE',
  'MISSING',
  'BROWSER_ERROR',
  'SITE_MISMATCH',
])

/** Official Assessment riskAnalysis.reasons labels. Not secrets/tokens. */
export const GOOGLE_ASSESSMENT_RISK_REASONS = Object.freeze([
  'CLASSIFICATION_REASON_UNSPECIFIED',
  'AUTOMATION',
  'UNEXPECTED_ENVIRONMENT',
  'TOO_MUCH_TRAFFIC',
  'UNEXPECTED_USAGE_PATTERNS',
  'LOW_CONFIDENCE_SCORE',
  'SUSPECTED_CARDING',
  'SUSPECTED_CHARGEBACK',
])

const GOOGLE_ASSESSMENT_INVALID_REASON_SET = new Set(GOOGLE_ASSESSMENT_INVALID_REASONS)
const GOOGLE_ASSESSMENT_RISK_REASON_SET = new Set(GOOGLE_ASSESSMENT_RISK_REASONS)

function safeInvalidReason(value) {
  if (typeof value !== 'string' || !GOOGLE_ASSESSMENT_INVALID_REASON_SET.has(value)) return null
  return value
}

function safeRiskReasons(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((code) => typeof code === 'string' && GOOGLE_ASSESSMENT_RISK_REASON_SET.has(code))
    .slice(0, 8)
}

function emptyDiagnostics(expectedAction = null) {
  return captchaDiagnosticsFromAssessment({}, expectedAction)
}

/**
 * Safe operational diagnostics from Google Assessment. Never includes token/API key/secret/IP/PII.
 */
export function captchaDiagnosticsFromAssessment(data = {}, expectedAction = null) {
  const props = data?.tokenProperties && typeof data.tokenProperties === 'object' ? data.tokenProperties : {}
  const risk = data?.riskAnalysis && typeof data.riskAnalysis === 'object' ? data.riskAnalysis : {}
  return {
    valid: typeof props.valid === 'boolean' ? props.valid : null,
    invalidReason: safeInvalidReason(props.invalidReason),
    hostname: typeof props.hostname === 'string' && props.hostname ? props.hostname : null,
    action: safeAction(props.action),
    score: typeof risk.score === 'number' ? risk.score : null,
    reasons: safeRiskReasons(risk.reasons),
    expectedAction: safeAction(expectedAction),
  }
}

export function publicCaptchaErrorCode(result) {
  const code = result?.code
  if (PUBLIC_CAPTCHA_CODES.has(code)) return code
  return 'captcha-rejected'
}

function fail(reason, diagnostics = emptyDiagnostics(), publicCode) {
  const code = publicCode || (PUBLIC_CAPTCHA_CODES.has(reason) ? reason : 'captcha-rejected')
  return { ok: false, code, reason, diagnostics }
}

function assessmentUrl(projectId, apiKey) {
  return `${ASSESSMENT_HOST}/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`
}

/**
 * Enterprise reCAPTCHA v3 via Google Assessment only.
 * Legacy siteverify / RECAPTCHA_SECRET_KEY are not used.
 *
 * Fail-closed:
 * - tokenProperties.valid === true
 * - tokenProperties.action matches the server-owned expectation when one exists
 * - tokenProperties.hostname is on the allowlist
 * - riskAnalysis.score meets RECAPTCHA_MIN_SCORE
 */
export async function verifyCaptchaToken(
  token,
  { remoteip, userAgent, expectedAction, allowedActions, fetchImpl } = {},
) {
  const projectId = recaptchaProjectId()
  const apiKey = recaptchaApiKey()
  const siteKey = recaptchaSiteKey()
  if (!projectId || !apiKey || !siteKey) {
    return fail('captcha-not-configured', emptyDiagnostics(expectedAction))
  }
  const minScore = recaptchaMinScore()
  const verifyTimeoutMs = recaptchaVerifyTimeoutMs()
  if (minScore === null || verifyTimeoutMs === null) {
    return fail('captcha-not-configured', emptyDiagnostics(expectedAction))
  }
  if (typeof token !== 'string' || token.length < 20 || token.length > 4000) {
    return fail('captcha-invalid', emptyDiagnostics(expectedAction), 'captcha-invalid')
  }

  const fetchFn = fetchImpl || globalThis.fetch
  if (typeof fetchFn !== 'function') {
    return fail('captcha-verify-failed', emptyDiagnostics(expectedAction))
  }

  const event = {
    token,
    siteKey,
  }
  if (typeof expectedAction === 'string' && expectedAction) {
    event.expectedAction = expectedAction
  }
  if (remoteip && remoteip !== 'unknown') event.userIpAddress = remoteip
  if (typeof userAgent === 'string' && userAgent.trim()) event.userAgent = userAgent.trim()

  let res
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), verifyTimeoutMs)
    : null
  try {
    res = await fetchFn(assessmentUrl(projectId, apiKey), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event }),
      ...(controller ? { signal: controller.signal } : {}),
    })
  } catch {
    return {
      ...fail('captcha-verify-failed', emptyDiagnostics(expectedAction)),
      upstream: { transportError: true, httpStatus: null, errorCode: null, errorStatus: null },
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }

  if (!res || !res.ok) {
    let errorBody = null
    try {
      errorBody = await res?.json()
    } catch {
      // Ignore malformed/non-JSON upstream error bodies.
    }
    const rawStatus = errorBody?.error?.status
    const safeStatus = typeof rawStatus === 'string' && /^[A-Z_]{2,64}$/.test(rawStatus) ? rawStatus : null
    const rawCode = errorBody?.error?.code
    const safeCode = Number.isInteger(rawCode) ? rawCode : null
    return {
      ...fail('captcha-verify-failed', emptyDiagnostics(expectedAction)),
      upstream: {
        transportError: false,
        httpStatus: Number.isInteger(res?.status) ? res.status : null,
        errorCode: safeCode,
        errorStatus: safeStatus,
      },
    }
  }

  let data
  try {
    data = await res.json()
  } catch {
    return {
      ...fail('captcha-verify-failed', emptyDiagnostics(expectedAction)),
      upstream: { transportError: false, httpStatus: Number.isInteger(res?.status) ? res.status : null, errorCode: null, errorStatus: 'INVALID_JSON_RESPONSE' },
    }
  }

  const diagnostics = captchaDiagnosticsFromAssessment(data, expectedAction)
  const props = data?.tokenProperties && typeof data.tokenProperties === 'object' ? data.tokenProperties : {}
  const risk = data?.riskAnalysis && typeof data.riskAnalysis === 'object' ? data.riskAnalysis : {}

  if (props.valid !== true) {
    return fail('captcha-google-rejected', diagnostics)
  }

  const actionBased = isActionBasedExpectation({ expectedAction, allowedActions })
  if (actionBased) {
    if (typeof props.action !== 'string' || !props.action) {
      return fail('captcha-action-mismatch', diagnostics)
    }
    if (!actionMatchesExpectation(props.action, { expectedAction, allowedActions })) {
      return fail('captcha-action-mismatch', diagnostics)
    }
  }

  if (typeof props.hostname !== 'string' || !props.hostname || !hostnameAllowed(props.hostname)) {
    return fail('captcha-hostname-mismatch', diagnostics)
  }

  if (typeof risk.score !== 'number') {
    return fail('captcha-google-rejected', diagnostics)
  }
  if (risk.score < minScore) return fail('captcha-score-too-low', diagnostics)

  return {
    ok: true,
    hostname: props.hostname || null,
    score: risk.score ?? null,
    action: props.action || null,
    reason: null,
    diagnostics,
  }
}
