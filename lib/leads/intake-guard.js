import {
  checkRateLimit,
  clientIp,
  hasControlledIntakeBypass,
  hasJsonContentType,
  hashClientKey,
  isBlockedOrigin,
  isTooFastSubmit,
  recordRateLimit,
} from './abuse-guard.js'
import { captchaRequired, verifyCaptchaToken } from './captcha.js'
import { readJsonBody } from './read-json-body.js'

export function intakeRateLimitKey(request) {
  return hashClientKey(clientIp(request), request.headers.get('user-agent') || 'unknown')
}

export async function enforcePublicIntake(request) {
  if (!hasJsonContentType(request)) {
    return { ok: false, code: 'invalid-content-type', status: 400 }
  }

  if (isBlockedOrigin(request)) {
    return { ok: false, code: 'request-blocked', status: 403 }
  }

  const rlKey = intakeRateLimitKey(request)
  if (!rlKey) {
    return { ok: false, code: 'too-many-requests', status: 429, headers: { 'Retry-After': '60' } }
  }

  const submitLimit = await checkRateLimit(rlKey, 'submit')
  if (!submitLimit.allowed) {
    return {
      ok: false,
      code: 'too-many-requests',
      status: 429,
      headers: { 'Retry-After': String(submitLimit.retryAfter ?? 60) },
    }
  }

  const body = await readJsonBody(request)
  if (!body.ok) {
    await recordRateLimit(rlKey, 'error')
    return { ok: false, code: body.code, status: body.status }
  }

  const raw = body.data
  if (!raw || typeof raw !== 'object') {
    await recordRateLimit(rlKey, 'error')
    return { ok: false, code: 'invalid-payload', status: 400 }
  }

  const bypass = hasControlledIntakeBypass(request)
  if (captchaRequired() && !bypass) {
    const token = typeof raw._recaptchaToken === 'string' ? raw._recaptchaToken : ''
    const action = typeof raw._recaptchaAction === 'string' ? raw._recaptchaAction : undefined
    const captcha = await verifyCaptchaToken(token, {
      remoteip: clientIp(request),
      expectedAction: action,
    })
    if (!captcha.ok) {
      await recordRateLimit(rlKey, 'error')
      return { ok: false, code: captcha.code, status: 403 }
    }
  }

  return { ok: true, raw, rlKey }
}

export function isBotLikeSubmit(validated) {
  if (!validated?.ok) return false
  if (validated.honeypotFilled) return true
  return isTooFastSubmit(validated.data?._formLoadedAt)
}
