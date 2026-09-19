/**
 * Client-side security utilities for form protection.
 * - Input sanitization (XSS prevention)
 * - Honeypot bot detection (dual fields)
 * - Timing-based bot detection
 * - Client-side rate limiting
 */

// ─── Input Sanitization ──────────────────────────────────────────

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g
const SCRIPT_RE = /(?:javascript|data|vbscript)\s*:/gi
const EVENT_RE = /\bon\w+\s*=/gi

/** Strip HTML tags, script URIs and event handlers from a string */
export function sanitizeString(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(HTML_TAG_RE, '')
    .replace(SCRIPT_RE, '')
    .replace(EVENT_RE, '')
    .trim()
}

/** Recursively sanitize all string values in an object */
export function sanitizePayload(obj) {
  if (typeof obj !== 'object' || obj === null) return sanitizeString(obj)
  const clean = Array.isArray(obj) ? [] : {}
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (typeof val === 'string') {
      clean[key] = sanitizeString(val)
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizePayload(val)
    } else {
      clean[key] = val
    }
  }
  return clean
}

// ─── Honeypot ────────────────────────────────────────────────────

/** Primary honeypot – looks like a real field to bots */
export const HONEYPOT_FIELD = 'website_url'

/** Secondary honeypot – another trap field */
export const HONEYPOT_FIELD_2 = 'company_fax'

/** Returns true if any honeypot was filled (= bot) */
export function isBot(honeypotValue, honeypotValue2) {
  if (typeof honeypotValue === 'string' && honeypotValue.length > 0) return true
  if (typeof honeypotValue2 === 'string' && honeypotValue2.length > 0) return true
  return false
}

// ─── Timing-Based Bot Detection ──────────────────────────────────

const formLoadTimes = new Map()

/** Call when form mounts to record start time */
export function recordFormLoad(formId) {
  formLoadTimes.set(formId, Date.now())
}

/**
 * Returns seconds since form loaded. Bots fill forms in < 3s.
 * Also returns the _formLoadedAt timestamp for backend validation.
 */
export function getFormTiming(formId) {
  const loadTime = formLoadTimes.get(formId) || Date.now()
  const elapsed = (Date.now() - loadTime) / 1000
  return { elapsedSeconds: elapsed, _formLoadedAt: loadTime }
}

/** Check if submission is suspiciously fast (< 3 seconds) */
export function isTooFast(formId, minSeconds = 3) {
  const { elapsedSeconds } = getFormTiming(formId)
  return elapsedSeconds < minSeconds
}

// ─── Rate Limiting ───────────────────────────────────────────────

const submissionLog = new Map()

/**
 * Client-side rate limiter per form.
 * @param {string} formId – unique identifier for the form
 * @param {number} cooldownMs – minimum ms between submits (default 30s)
 * @returns {{ allowed: boolean, remainingSeconds: number }}
 */
export function checkRateLimit(formId, cooldownMs = 30_000) {
  const now = Date.now()
  const last = submissionLog.get(formId) || 0
  const diff = now - last

  if (diff < cooldownMs) {
    return { allowed: false, remainingSeconds: Math.ceil((cooldownMs - diff) / 1000) }
  }
  return { allowed: true, remainingSeconds: 0 }
}

/** Mark a form as just submitted */
export function recordSubmission(formId) {
  submissionLog.set(formId, Date.now())
}

// ─── reCAPTCHA v3 ────────────────────────────────────────────────

let recaptchaScript = null
let recaptchaReady = false
let recaptchaLoadPromise = null
let visibleRecaptchaScript = null
let visibleRecaptchaReady = false

export class RecaptchaClientError extends Error {
  constructor(code, message) {
    super(message || code)
    this.name = 'RecaptchaClientError'
    this.code = code
  }
}

export function resetRecaptchaClientForTests() {
  recaptchaLoadPromise = null
  recaptchaReady = false
  recaptchaScript = null
}

function recaptchaPublicSiteKey() {
  return String(process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY || '').trim()
}

function isGrecaptchaV3Ready() {
  const g = typeof window !== 'undefined' ? window.grecaptcha : null
  return Boolean(g && typeof g.ready === 'function' && typeof g.execute === 'function')
}

export function isRecaptchaV3RuntimeReady() {
  return isGrecaptchaV3Ready()
}

function recaptchaWaitTimeoutMs() {
  const n = Number(process.env.RECAPTCHA_READY_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : 10_000
}

function scriptStatus(script) {
  return typeof script?.getAttribute === 'function' ? script.getAttribute('data-recaptcha-v3-status') || '' : ''
}

function markScript(script, status) {
  if (script && typeof script.setAttribute === 'function') {
    script.setAttribute('data-recaptcha-v3-status', status)
  }
}

function isUsableV3Script(script) {
  return Boolean(script) && scriptStatus(script) !== 'failed'
}

function findExistingV3Script() {
  if (typeof document === 'undefined') return null
  const marked = document.querySelector('script[data-recaptcha-v3="1"]')
  if (isUsableV3Script(marked)) return marked
  const scripts = document.querySelectorAll('script[src]')
  for (const script of scripts) {
    const src = script.getAttribute('src') || script.src || ''
    if (src.includes('enterprise.js') && src.includes('recaptcha')) continue
    if (!isUsableV3Script(script)) continue
    if (src.includes('recaptcha/api.js') && src.includes('render=') && !src.includes('render=explicit')) {
      return script
    }
  }
  return null
}

function waitForScript(script) {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.grecaptcha) {
      resolve()
      return
    }
    const status = scriptStatus(script)
    if (status === 'failed') {
      reject(new RecaptchaClientError('recaptcha-script-failed'))
      return
    }
    if (status === 'loaded' && !window.grecaptcha) {
      reject(new RecaptchaClientError('recaptcha-runtime-unavailable'))
      return
    }
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      markScript(script, 'failed')
      reject(new RecaptchaClientError('recaptcha-script-failed'))
    }, recaptchaWaitTimeoutMs())
    const ok = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      markScript(script, 'loaded')
      resolve()
    }
    const fail = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      markScript(script, 'failed')
      reject(new RecaptchaClientError('recaptcha-script-failed'))
    }
    if (typeof script.addEventListener === 'function') {
      script.addEventListener('load', ok, { once: true })
      script.addEventListener('error', fail, { once: true })
      return
    }
    const prevLoad = script.onload
    const prevError = script.onerror
    script.onload = () => {
      if (typeof prevLoad === 'function') prevLoad()
      ok()
    }
    script.onerror = () => {
      if (typeof prevError === 'function') prevError()
      fail()
    }
  })
}

function waitForGrecaptchaReady() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.grecaptcha) {
      reject(new RecaptchaClientError('recaptcha-runtime-unavailable'))
      return
    }
    if (typeof window.grecaptcha.ready !== 'function') {
      reject(new RecaptchaClientError('recaptcha-ready-unavailable'))
      return
    }
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new RecaptchaClientError('recaptcha-ready-timeout'))
    }, recaptchaWaitTimeoutMs())
    window.grecaptcha.ready(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (typeof window.grecaptcha.execute !== 'function') {
        reject(new RecaptchaClientError('recaptcha-execute-unavailable'))
        return
      }
      resolve()
    })
  })
}

async function loadRecaptchaInternal() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new RecaptchaClientError('recaptcha-window-unavailable')
  }

  const siteKey = recaptchaPublicSiteKey()
  if (!siteKey) {
    throw new RecaptchaClientError('recaptcha-not-configured')
  }

  if (isGrecaptchaV3Ready()) {
    await waitForGrecaptchaReady()
    recaptchaReady = true
    return
  }

  let script = findExistingV3Script()
  if (!script) {
    script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
    script.async = true
    script.defer = true
    script.setAttribute('data-recaptcha-v3', '1')
    const loaded = new Promise((resolve, reject) => {
      script.onload = () => {
        markScript(script, 'loaded')
        resolve()
      }
      script.onerror = () => {
        markScript(script, 'failed')
        reject(new RecaptchaClientError('recaptcha-script-failed'))
      }
    })
    document.head.appendChild(script)
    recaptchaScript = script
    await loaded
  } else if (!window.grecaptcha) {
    await waitForScript(script)
  }

  await waitForGrecaptchaReady()
  recaptchaReady = true
}

/**
 * Load Standard reCAPTCHA v3 (api.js?render=sitekey).
 * Idempotent: one in-flight promise, no duplicate v3 scripts, no Enterprise.
 * Resolves only after grecaptcha.ready() and execute() is callable.
 */
export async function loadRecaptcha() {
  if (recaptchaReady && isGrecaptchaV3Ready()) return
  if (recaptchaReady && !isGrecaptchaV3Ready()) {
    recaptchaReady = false
    recaptchaLoadPromise = null
  }
  if (recaptchaLoadPromise) return recaptchaLoadPromise

  recaptchaLoadPromise = loadRecaptchaInternal()
  try {
    await recaptchaLoadPromise
  } catch (err) {
    recaptchaLoadPromise = null
    recaptchaReady = false
    throw err
  }
}

/**
 * Mint a fresh Standard v3 token immediately before a protected POST.
 * Never treats a half-loaded grecaptcha object as ready.
 *
 * @param {string} action – Google v3 action (e.g., 'hero_funnel', 'career')
 * @returns {Promise<string>} reCAPTCHA token
 * @throws {RecaptchaClientError}
 */
export async function getRecaptchaToken(action) {
  if (typeof action !== 'string' || !action) {
    throw new RecaptchaClientError('recaptcha-action-invalid')
  }
  await loadRecaptcha()
  await waitForGrecaptchaReady()
  if (typeof window === 'undefined' || typeof window.grecaptcha?.execute !== 'function') {
    throw new RecaptchaClientError('recaptcha-execute-unavailable')
  }
  const siteKey = recaptchaPublicSiteKey()
  if (!siteKey) {
    throw new RecaptchaClientError('recaptcha-not-configured')
  }
  const token = await window.grecaptcha.execute(siteKey, { action })
  if (typeof token !== 'string' || !token) {
    throw new RecaptchaClientError('recaptcha-token-empty')
  }
  return token
}

// ─── reCAPTCHA Enterprise — not a supported DTH production variant ─
// NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY is ignored. Do not load enterprise.js.
// Do not verify Enterprise tokens via classic siteverify.

export function hasRecaptchaEnterpriseSiteKey() {
  return false
}

export function getRecaptchaEnterpriseSiteKey() {
  return ''
}

export async function loadRecaptchaEnterprise() {
  throw new Error('reCAPTCHA Enterprise is not a supported DTH production variant')
}

export async function getRecaptchaEnterpriseToken() {
  return null
}

// ─── Visible reCAPTCHA (Checkbox) ───────────────────────────────

/** Visible v2 checkbox. PUBLIC_KEY alone is Standard v3 execute, not the checkbox widget. */
export function hasVisibleRecaptchaSiteKey() {
  return Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY)
}

export function getVisibleRecaptchaSiteKey() {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''
}

/** Standard v3 execute (classic api.js). Not Enterprise. */
export function hasStandardV3SiteKey() {
  return Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY)
}

/**
 * Load reCAPTCHA checkbox script (explicit mode) for visible widgets.
 */
export async function loadVisibleRecaptcha() {
  if (visibleRecaptchaReady) return

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-recaptcha-visible="1"]')
    if (existing && typeof window !== 'undefined' && window.grecaptcha) {
      visibleRecaptchaReady = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.setAttribute('data-recaptcha-visible', '1')

    script.onload = () => {
      const finish = () => {
        if (typeof window !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.render === 'function') {
          visibleRecaptchaReady = true
          resolve()
        } else if (typeof window !== 'undefined' && window.grecaptcha) {
          // api.js onload can precede render attachment; grecaptcha.ready is authoritative.
          window.grecaptcha.ready(() => {
            if (typeof window.grecaptcha.render === 'function') {
              visibleRecaptchaReady = true
              resolve()
            } else {
              reject(new Error('Visible reCAPTCHA script loaded but grecaptcha.render unavailable'))
            }
          })
        } else {
          reject(new Error('Visible reCAPTCHA script loaded but grecaptcha not available'))
        }
      }
      finish()
    }

    script.onerror = () => reject(new Error('Failed to load visible reCAPTCHA script'))
    document.head.appendChild(script)
    visibleRecaptchaScript = script
  })
}

/**
 * Render visible reCAPTCHA checkbox widget.
 * @returns {Promise<number>} widget id
 */
export async function renderVisibleRecaptcha(container, opts = {}) {
  await loadVisibleRecaptcha()
  if (!window.grecaptcha || typeof window.grecaptcha.render !== 'function') {
    throw new Error('grecaptcha.render unavailable')
  }

  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      try {
        const widgetId = window.grecaptcha.render(container, {
          sitekey: getVisibleRecaptchaSiteKey(),
          theme: opts.theme || 'dark',
          size: 'normal',
          callback: opts.callback,
          'expired-callback': opts.expiredCallback,
        })
        resolve(widgetId)
      } catch (err) {
        reject(err)
      }
    })
  })
}

export function resetVisibleRecaptcha(widgetId) {
  if (typeof widgetId !== 'number') return
  if (typeof window === 'undefined' || !window.grecaptcha) return
  window.grecaptcha.reset(widgetId)
}
