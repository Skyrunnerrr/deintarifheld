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
let visibleRecaptchaScript = null
let visibleRecaptchaReady = false
let enterpriseRecaptchaScript = null
let enterpriseRecaptchaReady = false

/**
 * Load reCAPTCHA v3 script (idempotent – loads only once).
 * Call this when app mounts or before first form submission.
 */
export async function loadRecaptcha() {
  if (recaptchaReady) return

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY}`
    script.async = true
    script.defer = true

    script.onload = () => {
      if (typeof window !== 'undefined' && window.grecaptcha) {
        recaptchaReady = true
        resolve()
      } else {
        reject(new Error('reCAPTCHA script loaded but grecaptcha not available'))
      }
    }

    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'))
    document.head.appendChild(script)
    recaptchaScript = script
  })
}

/**
 * Generate a reCAPTCHA v3 token for a given action.
 * Must call loadRecaptcha() first or ensure script is ready.
 *
 * @param {string} action – form identifier (e.g., 'hero-funnel', 'career')
 * @returns {Promise<string>} reCAPTCHA token
 * @throws {Error} if reCAPTCHA not ready
 */
export async function getRecaptchaToken(action = 'submit') {
  if (!recaptchaReady) {
    try {
      await loadRecaptcha()
    } catch (err) {
      console.warn('⚠️ reCAPTCHA loading failed:', err.message)
      // Graceful fallback: continue without token if critical error
      return null
    }
  }

  if (typeof window === 'undefined' || !window.grecaptcha) {
    console.warn('⚠️ grecaptcha not available')
    return null
  }

  try {
    const token = await window.grecaptcha.execute(
      process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY,
      { action }
    )
    return token
  } catch (err) {
    console.error('❌ reCAPTCHA token generation failed:', err)
    return null
  }
}

// ─── reCAPTCHA Enterprise (token via execute) ─────────────────

export function hasRecaptchaEnterpriseSiteKey() {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY
  )
}

export function getRecaptchaEnterpriseSiteKey() {
  return (
    process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY ||
    ''
  )
}

export async function loadRecaptchaEnterprise() {
  if (enterpriseRecaptchaReady) return

  const siteKey = getRecaptchaEnterpriseSiteKey()
  if (!siteKey) throw new Error('Missing reCAPTCHA enterprise site key')

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-recaptcha-enterprise="1"]')
    if (existing && typeof window !== 'undefined' && window.grecaptcha && window.grecaptcha.enterprise) {
      enterpriseRecaptchaReady = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`
    script.async = true
    script.defer = true
    script.setAttribute('data-recaptcha-enterprise', '1')

    script.onload = () => {
      if (typeof window !== 'undefined' && window.grecaptcha && window.grecaptcha.enterprise) {
        enterpriseRecaptchaReady = true
        resolve()
      } else {
        reject(new Error('Enterprise script loaded but grecaptcha.enterprise unavailable'))
      }
    }

    script.onerror = () => reject(new Error('Failed to load reCAPTCHA enterprise script'))
    document.head.appendChild(script)
    enterpriseRecaptchaScript = script
  })
}

export async function getRecaptchaEnterpriseToken(action = 'submit') {
  if (!hasRecaptchaEnterpriseSiteKey()) return null

  try {
    await loadRecaptchaEnterprise()
  } catch (err) {
    console.warn('⚠️ reCAPTCHA enterprise loading failed:', err.message)
    return null
  }

  if (
    typeof window === 'undefined' ||
    !window.grecaptcha ||
    !window.grecaptcha.enterprise
  ) {
    return null
  }

  const siteKey = getRecaptchaEnterpriseSiteKey()

  try {
    return await new Promise((resolve, reject) => {
      window.grecaptcha.enterprise.ready(async () => {
        try {
          const token = await window.grecaptcha.enterprise.execute(siteKey, { action })
          resolve(token || null)
        } catch (e) {
          reject(e)
        }
      })
    })
  } catch (err) {
    console.error('❌ reCAPTCHA enterprise token generation failed:', err)
    return null
  }
}

// ─── Visible reCAPTCHA (Checkbox) ───────────────────────────────

export function hasVisibleRecaptchaSiteKey() {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY
  )
}

export function getVisibleRecaptchaSiteKey() {
  return (
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY ||
    ''
  )
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
      if (typeof window !== 'undefined' && window.grecaptcha) {
        visibleRecaptchaReady = true
        resolve()
      } else {
        reject(new Error('Visible reCAPTCHA script loaded but grecaptcha not available'))
      }
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
  if (!window.grecaptcha) throw new Error('grecaptcha unavailable')

  return window.grecaptcha.render(container, {
    sitekey: getVisibleRecaptchaSiteKey(),
    theme: opts.theme || 'dark',
    size: 'normal',
    callback: opts.callback,
    'expired-callback': opts.expiredCallback,
  })
}

export function resetVisibleRecaptcha(widgetId) {
  if (typeof widgetId !== 'number') return
  if (typeof window === 'undefined' || !window.grecaptcha) return
  window.grecaptcha.reset(widgetId)
}
