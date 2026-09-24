/**
 * Browser form utilities.
 * Server validation, reCAPTCHA and rate limiting are authoritative security controls.
 * - Input normalization before transport
 * - Honeypot field names transported for server evaluation
 * - Non-blocking form timing telemetry
 * - reCAPTCHA client lifecycle
 */

// ─── Input normalization ─────────────────────────────────────────

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g
const SCRIPT_RE = /(?:javascript|data|vbscript)\s*:/gi
const EVENT_RE = /\bon\w+\s*=/gi

/** Normalize obvious markup/script-like input before transport. Not a server security boundary. */
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

// ─── Form timing telemetry ───────────────────────────────────────

const formLoadTimes = new Map()

/** Call when form mounts to record start time */
export function recordFormLoad(formId) {
  formLoadTimes.set(formId, Date.now())
}

/**
 * Returns elapsed time plus the original load timestamp.
 * This is telemetry only. Server-side bot decisions must not trust client timing.
 */
export function getFormTiming(formId) {
  const loadTime = formLoadTimes.get(formId) || Date.now()
  const elapsed = (Date.now() - loadTime) / 1000
  return { elapsedSeconds: elapsed, _formLoadedAt: loadTime }
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

function getEnterpriseGrecaptcha() {
  if (typeof window === 'undefined') return null
  const enterprise = window.grecaptcha?.enterprise
  return enterprise && typeof enterprise === 'object' ? enterprise : null
}

function isGrecaptchaV3Ready() {
  const g = getEnterpriseGrecaptcha()
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

export function v3ScriptRenderParam(src) {
  const value = String(src || '')
  try {
    const url = new URL(value, 'https://www.google.com')
    return url.searchParams.get('render') || ''
  } catch {
    const match = value.match(/[?&]render=([^&#]+)/)
    return match ? decodeURIComponent(match[1]) : ''
  }
}

export function isCurrentV3ScriptSrc(src, siteKey = recaptchaPublicSiteKey()) {
  const value = String(src || '')
  if (!siteKey) return false
  if (!value.includes('recaptcha/enterprise.js')) return false
  const render = v3ScriptRenderParam(value)
  if (!render || render === 'explicit') return false
  return render === siteKey
}

export function isConflictingV3ScriptSrc(src, siteKey = recaptchaPublicSiteKey()) {
  const value = String(src || '')
  const render = v3ScriptRenderParam(value)
  if (!render || render === 'explicit') return false
  if (value.includes('recaptcha/enterprise.js')) {
    return Boolean(siteKey) && render !== siteKey
  }
  if (value.includes('recaptcha/api.js')) return true
  return false
}

function scriptSrc(script) {
  return (typeof script?.getAttribute === 'function' ? script.getAttribute('src') : '') || script?.src || ''
}

function findExistingV3Script() {
  if (typeof document === 'undefined') return null
  const siteKey = recaptchaPublicSiteKey()
  const marked = document.querySelector('script[data-recaptcha-v3="1"]')
  if (isUsableV3Script(marked) && isCurrentV3ScriptSrc(scriptSrc(marked), siteKey)) {
    return marked
  }
  const scripts = document.querySelectorAll('script[src]')
  for (const script of scripts) {
    if (!isUsableV3Script(script)) continue
    if (isCurrentV3ScriptSrc(scriptSrc(script), siteKey)) return script
  }
  return null
}

function hasConflictingV3Script() {
  if (typeof document === 'undefined') return false
  const siteKey = recaptchaPublicSiteKey()
  const scripts = document.querySelectorAll('script[src]')
  for (const script of scripts) {
    if (isConflictingV3ScriptSrc(scriptSrc(script), siteKey)) return true
  }
  return false
}

function waitForScript(script) {
  return new Promise((resolve, reject) => {
    if (getEnterpriseGrecaptcha()) {
      resolve()
      return
    }
    const status = scriptStatus(script)
    if (status === 'failed') {
      reject(new RecaptchaClientError('recaptcha-script-failed'))
      return
    }
    if (status === 'loaded' && !getEnterpriseGrecaptcha()) {
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
    const g = getEnterpriseGrecaptcha()
    if (!g) {
      reject(new RecaptchaClientError('recaptcha-runtime-unavailable'))
      return
    }
    if (typeof g.ready !== 'function') {
      reject(new RecaptchaClientError('recaptcha-ready-unavailable'))
      return
    }
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new RecaptchaClientError('recaptcha-ready-timeout'))
    }, recaptchaWaitTimeoutMs())
    g.ready(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (typeof getEnterpriseGrecaptcha()?.execute !== 'function') {
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

  if (hasConflictingV3Script()) {
    throw new RecaptchaClientError('recaptcha-script-mismatch')
  }

  if (isGrecaptchaV3Ready()) {
    await waitForGrecaptchaReady()
    recaptchaReady = true
    return
  }

  let script = findExistingV3Script()
  if (!script) {
    script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`
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
  } else if (!getEnterpriseGrecaptcha()) {
    await waitForScript(script)
  }

  await waitForGrecaptchaReady()
  recaptchaReady = true
}

/**
 * Load Enterprise reCAPTCHA v3 (enterprise.js?render=sitekey).
 * Idempotent: one in-flight promise, no duplicate v3 scripts.
 * Resolves only after grecaptcha.enterprise.ready() and execute() is callable.
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
 * Mint a fresh Enterprise v3 token immediately before a protected POST.
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
  const enterprise = getEnterpriseGrecaptcha()
  if (typeof enterprise?.execute !== 'function') {
    throw new RecaptchaClientError('recaptcha-execute-unavailable')
  }
  const siteKey = recaptchaPublicSiteKey()
  if (!siteKey) {
    throw new RecaptchaClientError('recaptcha-not-configured')
  }
  const token = await enterprise.execute(siteKey, { action })
  if (typeof token !== 'string' || !token) {
    throw new RecaptchaClientError('recaptcha-token-empty')
  }
  return token
}

// ─── Separate ENTERPRISE_SITE_KEY env is unused. Production uses PUBLIC_KEY + enterprise.js. ─

export function hasRecaptchaEnterpriseSiteKey() {
  return false
}

export function getRecaptchaEnterpriseSiteKey() {
  return ''
}

export async function loadRecaptchaEnterprise() {
  return loadRecaptcha()
}

export async function getRecaptchaEnterpriseToken(action) {
  return getRecaptchaToken(action)
}

// ─── Visible reCAPTCHA (Checkbox) ───────────────────────────────

/** Visible v2 checkbox. PUBLIC_KEY alone is Standard v3 execute, not the checkbox widget. */
export function hasVisibleRecaptchaSiteKey() {
  return Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY)
}

export function getVisibleRecaptchaSiteKey() {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''
}

/** Production v3 execute (enterprise.js + NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY). */
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
