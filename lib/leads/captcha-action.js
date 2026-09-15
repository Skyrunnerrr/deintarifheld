/**
 * Server-owned reCAPTCHA action binding.
 *
 * The browser may send `_recaptchaAction` as telemetry. That value MUST NOT
 * become the server expectedAction. Expected actions are derived only from
 * the endpoint + known page_source allowlist. Names match existing forms:
 *   unternehmen | career | hero-funnel | main_funnel
 * There is no form action named "privat"; private page_source=privat accepts
 * only the existing private form actions.
 */

export const CAPTCHA_ACTION_UNTERNEHMEN = 'unternehmen'
export const CAPTCHA_ACTION_CAREER = 'career'
export const CAPTCHA_ACTION_HERO = 'hero-funnel'
export const CAPTCHA_ACTION_FUNNEL = 'main_funnel'

export const PRIVATE_CAPTCHA_ACTIONS = Object.freeze([CAPTCHA_ACTION_HERO, CAPTCHA_ACTION_FUNNEL])

export const CAPTCHA_PRODUCTION_VARIANT = 'standard_v2_v3_siteverify'

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

  if (!src || src === 'unternehmen') {
    return { ok: true, context: 'business', expectedAction: CAPTCHA_ACTION_UNTERNEHMEN }
  }

  if (src === CAPTCHA_ACTION_HERO) {
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
