import {
  clientIp,
  hasControlledIntakeBypass,
  hasJsonContentType,
  hashClientKey,
  isBlockedOrigin,
  isTooFastSubmit,
} from './abuse-guard.js'
import { consumeRateLimit } from './rate-limit-provider.js'
import { captchaRequired, verifyCaptchaToken } from './captcha.js'
import { resolveExpectedCaptchaAction } from './captcha-action.js'
import { readJsonBody } from './read-json-body.js'

export function intakeRateLimitKey(request) {
  return hashClientKey(clientIp(request), request.headers.get('user-agent') || 'unknown')
}

/**
 * @param {Request} request
 * @param {{ endpoint?: 'leads' | 'careers' }} [options]
 */
export async function enforcePublicIntake(request, options = {}) {
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

  const submitLimit = await consumeRateLimit(rlKey, 'submit')
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
    await consumeRateLimit(rlKey, 'error')
    return { ok: false, code: body.code, status: body.status }
  }

  const raw = body.data
  if (!raw || typeof raw !== 'object') {
    await consumeRateLimit(rlKey, 'error')
    return { ok: false, code: 'invalid-payload', status: 400 }
  }

  const bypass = hasControlledIntakeBypass(request)
  if (captchaRequired() && !bypass) {
    const token = typeof raw._recaptchaToken === 'string' ? raw._recaptchaToken : ''
    const pageSource = typeof raw.page_source === 'string' ? raw.page_source : ''
    const binding = resolveExpectedCaptchaAction({
      endpoint: options.endpoint || 'leads',
      pageSource,
    })
    if (!binding.ok) {
      await consumeRateLimit(rlKey, 'error')
      return { ok: false, code: binding.code, status: 403 }
    }
    // `_recaptchaAction` is telemetry only — never used as expectedAction.
    const captcha = await verifyCaptchaToken(token, {
      remoteip: clientIp(request),
      expectedAction: binding.expectedAction,
      allowedActions: binding.allowedActions,
    })
    if (!captcha.ok) {
      await consumeRateLimit(rlKey, 'error')
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
