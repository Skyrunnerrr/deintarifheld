/**
 * Server-owned reCAPTCHA action binding.
 *
 * The browser may send `_recaptchaAction` as telemetry. That value MUST NOT
 * become the server expectedAction. Expected actions are derived only from
 * the endpoint + known page_source allowlist.
 *
 * Google v3 action names must match /^[A-Za-z0-9/_]+$/ (no hyphens).
 * page_source `hero-funnel` stays the data field; the Google action is `hero_funnel`.
 */

export const CAPTCHA_ACTION_UNTERNEHMEN = 'unternehmen'
export const CAPTCHA_ACTION_CAREER = 'career'
export const CAPTCHA_ACTION_HERO = 'hero_funnel'
export const CAPTCHA_ACTION_FUNNEL = 'main_funnel'
export const PAGE_SOURCE_HERO = 'hero-funnel'

export const CONFIGURED_V3_ACTIONS = Object.freeze([
  CAPTCHA_ACTION_UNTERNEHMEN,
  CAPTCHA_ACTION_CAREER,
  CAPTCHA_ACTION_FUNNEL,
  CAPTCHA_ACTION_HERO,
])

export const PRIVATE_CAPTCHA_ACTIONS = Object.freeze([CAPTCHA_ACTION_HERO, CAPTCHA_ACTION_FUNNEL])

export const CAPTCHA_PRODUCTION_VARIANT = 'enterprise_v3_assessment'

/** Google reCAPTCHA v3 action charset. Hyphens are invalid. */
export const GOOGLE_V3_ACTION_RE = /^[A-Za-z0-9/_]+$/

export function isValidGoogleV3Action(action) {
  return typeof action === 'string' && GOOGLE_V3_ACTION_RE.test(action)
}

export function assertConfiguredV3ActionsValid() {
  const invalid = CONFIGURED_V3_ACTIONS.filter((action) => !isValidGoogleV3Action(action))
  return { ok: invalid.length === 0, invalid }
}

/**
 * @param {{ endpoint?: string, pageSource?: string }} ctx
 * @returns {{ ok: true, context: string, expectedAction?: string, allowedActions?: string[] } | { ok: false, code: string }}
 */
export function resolveExpectedCaptchaAction({ endpoint, pageSource } = {}) {
  const ep = typeof endpoint === 'string' ? endpoint.trim() : 'leads'
  const src = typeof pageSource === 'string' ? pageSource.trim() : ''

  if (ep === 'careers') {
    return { ok: true, context: 'career', expectedAction: CAPTCHA_ACTION_CAREER }
  }

  if (ep !== 'leads') {
    return { ok: false, code: 'captcha-action-unknown-context' }
  }

  if (src === 'career') {
    return { ok: false, code: 'captcha-action-unknown-context' }
  }

  if (src === 'unternehmen') {
    return { ok: true, context: 'business', expectedAction: CAPTCHA_ACTION_UNTERNEHMEN }
  }

  if (!src) {
    return { ok: false, code: 'captcha-action-unknown-context' }
  }

  if (src === PAGE_SOURCE_HERO) {
    return { ok: true, context: 'private', expectedAction: CAPTCHA_ACTION_HERO }
  }

  if (src === CAPTCHA_ACTION_FUNNEL) {
    return { ok: true, context: 'private', expectedAction: CAPTCHA_ACTION_FUNNEL }
  }

  if (src === 'privat') {
    return {
      ok: true,
      context: 'private',
      allowedActions: [...PRIVATE_CAPTCHA_ACTIONS],
    }
  }

  return { ok: false, code: 'captcha-action-unknown-context' }
}

export function actionMatchesExpectation(action, { expectedAction, allowedActions } = {}) {
  if (typeof action !== 'string' || !action) return false
  if (typeof expectedAction === 'string' && expectedAction) {
    return action === expectedAction
  }
  if (Array.isArray(allowedActions) && allowedActions.length) {
    return allowedActions.includes(action)
  }
  return false
}

export function isActionBasedExpectation({ expectedAction, allowedActions } = {}) {
  if (typeof expectedAction === 'string' && expectedAction) return true
  return Array.isArray(allowedActions) && allowedActions.length > 0
}
