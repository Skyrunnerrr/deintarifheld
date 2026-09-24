#!/usr/bin/env node
/**
 * Enterprise reCAPTCHA v3 Assessment submit-contract proofs.
 * No production POST, no Checkdomain upload, no customer mail. Fetch is mocked.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowedOrigins } from '../lib/leads/cors.js'
import {
  captchaDiagnosticsFromAssessment,
  GOOGLE_ASSESSMENT_INVALID_REASONS,
  GOOGLE_ASSESSMENT_RISK_REASONS,
  publicCaptchaErrorCode,
  recaptchaMinScore,
  recaptchaVerifyTimeoutMs,
  verifyCaptchaToken,
} from '../lib/leads/captcha.js'
import { resolveExpectedCaptchaAction } from '../lib/leads/captcha-action.js'
import { enforcePublicIntake } from '../lib/leads/intake-guard.js'
import { resetRateLimitsForTests } from '../lib/leads/abuse-guard.js'
import { customerMailDualGuardOpen } from '../lib/leads/mail.js'
import {
  RecaptchaClientError,
  getRecaptchaToken,
  hasStandardV3SiteKey,
  hasVisibleRecaptchaSiteKey,
  isConflictingV3ScriptSrc,
  isCurrentV3ScriptSrc,
  loadRecaptcha,
  resetRecaptchaClientForTests,
  sanitizePayload,
  sanitizeString,
} from '../lib/security.js'
import {
  awaitFreshRecaptchaToken,
  isCaptchaPublicCode,
  mapLeadSubmitUserMessage,
  resolveSubmitCaptchaToken,
} from '../lib/leads/form-submit.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')
const SITE_KEY = 'test-public-site-key'
const TOKEN = 'token-from-browser-ok-12345'
const SECRET = 'rsecret-must-never-appear-in-logs'
const API_KEY = 'rapikey-must-never-appear-in-logs'
const PROJECT_ID = 'dth-test-project'
const ENTERPRISE_ENV = {
  NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY,
  RECAPTCHA_PROJECT_ID: PROJECT_ID,
  RECAPTCHA_API_KEY: API_KEY,
}

const FORM_FILES = {
  hero: 'components/sections/Hero.jsx',
  funnel: 'components/sections/FunnelSection.jsx',
  business: 'components/business/BusinessForm.jsx',
  career: 'components/sections/CareerSection.jsx',
  legacyBusiness: 'app/unternehmen/page.js',
}

function withEnv(patch, fn) {
  const prev = {}
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    })
}

function installBrowserMocks() {
  const scripts = []
  const document = {
    head: {
      appendChild(el) {
        scripts.push(el)
        return el
      },
    },
    createElement(tag) {
      if (tag !== 'script') return { tagName: String(tag).toUpperCase() }
      const el = {
        tagName: 'SCRIPT',
        src: '',
        async: false,
        defer: false,
        onload: null,
        onerror: null,
        attrs: {},
        listeners: { load: [], error: [] },
        setAttribute(k, v) {
          this.attrs[k] = String(v)
        },
        getAttribute(k) {
          if (k === 'src') return this.src
          return this.attrs[k]
        },
        addEventListener(type, fn) {
          if (!this.listeners[type]) this.listeners[type] = []
          this.listeners[type].push(fn)
        },
      }
      return el
    },
    querySelector(sel) {
      const value = String(sel)
      if (value.includes('data-recaptcha-v3')) {
        return scripts.find((s) => s.attrs['data-recaptcha-v3'] === '1') || null
      }
      if (value.includes('recaptcha/enterprise.js') && value.includes('render=')) {
        return scripts.find((s) => String(s.src).includes('recaptcha/enterprise.js') && String(s.src).includes('render=')) || null
      }
      return null
    },
    querySelectorAll(sel) {
      if (String(sel).includes('script')) return scripts.slice()
      return []
    },
  }
  globalThis.document = document
  globalThis.window = globalThis
  return { scripts, document }
}

function fireScriptLoad(script) {
  if (typeof script.onload === 'function') script.onload()
  for (const fn of script.listeners.load || []) fn()
}

function assessmentPayload({
  valid = true,
  invalidReason,
  hostname = 'www.deintarifheld.de',
  action = 'unternehmen',
  score = 0.9,
  reasons = [],
} = {}) {
  return {
    tokenProperties: {
      valid,
      ...(invalidReason ? { invalidReason } : {}),
      hostname,
      action,
    },
    riskAnalysis: {
      score,
      reasons,
    },
  }
}

function assessmentFetch(payload, { expectedAction } = {}) {
  return async (url, init = {}) => {
    const href = String(url)
    assert.match(href, new RegExp(`${PROJECT_ID}/assessments`))
    assert.match(href, /recaptchaenterprise\.googleapis\.com\/v1\/projects\//)
    assert.doesNotMatch(href, /recaptcha\/api\/siteverify/)
    const body = JSON.parse(String(init.body || '{}'))
    assert.equal(body.event.siteKey, SITE_KEY)
    assert.equal(body.event.token, TOKEN)
    if (expectedAction) assert.equal(body.event.expectedAction, expectedAction)
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function jsonRequest(body) {
  return new Request('https://deintarifheld-leads-api.vercel.app/api/leads/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.deintarifheld.de',
    },
    body: JSON.stringify(body),
  })
}

function captureLogs(fn) {
  const lines = []
  const origLog = console.log
  const origError = console.error
  const origWarn = console.warn
  const push = (...args) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  }
  console.log = (...args) => {
    push(...args)
  }
  console.error = (...args) => {
    push(...args)
  }
  console.warn = (...args) => {
    push(...args)
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = origLog
      console.error = origError
      console.warn = origWarn
    })
    .then((result) => ({ result, lines: lines.join('\n') }))
}

function assertNoSecretOrTokenLeak(dump, token = TOKEN, secret = SECRET, apiKey = API_KEY) {
  assert.doesNotMatch(dump, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(dump, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(dump, new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(dump, /RECAPTCHA_SECRET_KEY\s*[:=]/)
  assert.doesNotMatch(dump, /RECAPTCHA_API_KEY\s*[:=]/)
}

function readyGrecaptcha({ execute } = {}) {
  const state = { readyCalls: 0, executeCalls: [] }
  globalThis.grecaptcha = {
    enterprise: {
      ready(cb) {
        state.readyCalls += 1
        cb()
      },
      execute: execute || (async (siteKey, opts) => {
        state.executeCalls.push({ siteKey, opts })
        return `fresh-${state.executeCalls.length}-${opts.action}-xxxxxxxxxx`
      }),
    },
  }
  globalThis.window.grecaptcha = globalThis.grecaptcha
  return state
}

async function assertLoadRecaptchaContract() {
  await withEnv({ NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY }, async () => {
    resetRecaptchaClientForTests()
    const { scripts } = installBrowserMocks()

    const queued = []
    globalThis.grecaptcha = {
      enterprise: {
        ready(cb) {
          queued.push(cb)
        },
      },
    }
    globalThis.window.grecaptcha = globalThis.grecaptcha

    let resolved = false
    const pending = loadRecaptcha().then(() => {
      resolved = true
    })

    assert.equal(scripts.length, 1)
    assert.match(scripts[0].src, /recaptcha\/enterprise\.js\?render=/)
    assert.doesNotMatch(scripts[0].src, /recaptcha\/api\.js/)
    assert.equal(scripts[0].attrs['data-recaptcha-v3'], '1')

    fireScriptLoad(scripts[0])
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(resolved, false, 'loadRecaptcha must wait for grecaptcha.enterprise.ready()')

    globalThis.grecaptcha.enterprise.execute = async () => 'not-used-xxxxxxxxxx'
    queued.forEach((cb) => cb())
    await pending
    assert.equal(resolved, true)
    assert.equal(typeof globalThis.grecaptcha.enterprise.ready, 'function')
    assert.equal(typeof globalThis.grecaptcha.enterprise.execute, 'function')

    resetRecaptchaClientForTests()
    const { scripts: concurrent } = installBrowserMocks()
    delete globalThis.grecaptcha
    const concurrentLoads = Promise.all([loadRecaptcha(), loadRecaptcha(), loadRecaptcha()])
    assert.equal(concurrent.length, 1, 'concurrent loadRecaptcha must inject one v3 script')
    assert.equal(document.querySelectorAll('script[src]').filter((s) => String(s.src).includes('recaptcha/enterprise.js')).length, 1)
    readyGrecaptcha()
    fireScriptLoad(concurrent[0])
    await concurrentLoads

    resetRecaptchaClientForTests()
    const halfLoaded = installBrowserMocks()
    globalThis.grecaptcha = {
      enterprise: {
        ready(cb) {
          cb()
        },
      },
    }
    globalThis.window.grecaptcha = globalThis.grecaptcha
    const missingExecute = loadRecaptcha()
    fireScriptLoad(halfLoaded.scripts[0])
    await assert.rejects(
      missingExecute,
      (err) => err instanceof RecaptchaClientError && err.code === 'recaptcha-execute-unavailable',
    )

    resetRecaptchaClientForTests()
    const failedOnce = installBrowserMocks()
    delete globalThis.grecaptcha
    const firstFail = loadRecaptcha()
    failedOnce.scripts[0].onerror()
    await assert.rejects(
      firstFail,
      (err) => err instanceof RecaptchaClientError && err.code === 'recaptcha-script-failed',
    )
    assert.equal(failedOnce.scripts[0].attrs['data-recaptcha-v3-status'], 'failed')
    const retry = loadRecaptcha()
    assert.equal(failedOnce.scripts.length, 2, 'failed v3 script must not be reused')
    readyGrecaptcha()
    fireScriptLoad(failedOnce.scripts[1])
    await retry

    await withEnv({ NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY, RECAPTCHA_READY_TIMEOUT_MS: '40' }, async () => {
      resetRecaptchaClientForTests()
      const hung = installBrowserMocks()
      globalThis.grecaptcha = {
        enterprise: {
          ready() {
            /* never invokes callback */
          },
        },
      }
      globalThis.window.grecaptcha = globalThis.grecaptcha
      const pending = loadRecaptcha()
      fireScriptLoad(hung.scripts[0])
      await assert.rejects(
        pending,
        (err) => err instanceof RecaptchaClientError && err.code === 'recaptcha-ready-timeout',
      )
    })
  })
  console.log('P0_RECAPTCHA_LOAD=PASS')
}

async function assertGetTokenContract() {
  await withEnv({ NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY }, async () => {
    resetRecaptchaClientForTests()
    const { scripts } = installBrowserMocks()
    delete globalThis.grecaptcha
    const first = getRecaptchaToken('hero_funnel')
    assert.equal(scripts.length, 1)
    const state = readyGrecaptcha()
    fireScriptLoad(scripts[0])
    const token1 = await first
    const token2 = await getRecaptchaToken('hero_funnel')
    assert.match(token1, /hero_funnel/)
    assert.match(token2, /hero_funnel/)
    assert.notEqual(token1, token2, 'each submit must mint a fresh token')
    assert.equal(state.executeCalls.length, 2)
    assert.equal(state.executeCalls[0].siteKey, SITE_KEY)
    assert.equal(state.executeCalls[0].opts.action, 'hero_funnel')
    assert.equal(state.readyCalls >= 2, true, 'execute path must wait through ready()')

    resetRecaptchaClientForTests()
    const half = installBrowserMocks()
    globalThis.grecaptcha = {
      enterprise: {
        ready(cb) {
          cb()
        },
      },
    }
    globalThis.window.grecaptcha = globalThis.grecaptcha
    const failed = getRecaptchaToken('main_funnel')
    fireScriptLoad(half.scripts[0])
    await assert.rejects(
      failed,
      (err) => err instanceof RecaptchaClientError && err.code === 'recaptcha-execute-unavailable',
    )

    let posted = false
    const minted = await awaitFreshRecaptchaToken('career')
    assert.equal(minted.ok, false)
    assert.equal(minted.code, 'recaptcha-execute-unavailable')
    if (minted.ok) posted = true
    assert.equal(posted, false, 'execute unavailable must not POST')
  })
  console.log('P0_RECAPTCHA_TOKEN=PASS')
}

async function assertFormTokenFlow() {
  const actions = {
    hero: { action: 'hero_funnel', page: 'hero-funnel' },
    funnel: { action: 'main_funnel', page: 'main_funnel' },
    business: { action: 'unternehmen', page: 'unternehmen' },
    career: { action: 'career', page: 'career' },
    legacyBusiness: { action: 'unternehmen', page: 'unternehmen' },
  }

  for (const [name, rel] of Object.entries(FORM_FILES)) {
    const src = read(rel)
    const expected = actions[name]
    assert.match(src, /resolveSubmitCaptchaToken\(/)
    assert.match(src, new RegExp(`resolveSubmitCaptchaToken\\(\\s*'${expected.action}'\\s*,\\s*recaptchaToken\\s*\\)`))
    assert.match(src, new RegExp(`_recaptchaAction:\\s*'${expected.action}'`))
    assert.match(src, new RegExp(`page_source:\\s*'${expected.page}'`))
    assert.match(src, /_recaptchaToken:\s*captcha\.token/)
    assert.match(src, /const \[recaptchaToken,\s*setRecaptchaToken\]/)
    assert.match(src, /onToken=\{setRecaptchaToken\}/)
    assert.doesNotMatch(src, /_recaptchaToken:\s*recaptchaToken/)
    assert.doesNotMatch(src, /90_000|90000/)
    assert.match(src, /mapLeadSubmitUserMessage/)
    assert.doesNotMatch(src, /Bitte prüfe deine Verbindung und versuche es erneut/)
    assert.doesNotMatch(src, /Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut/)
    assert.match(src, /if\s*\(\s*!captcha\.ok\s*\)/)
    assert.match(src, /if\s*\(\s*(sending|loading)\s*\)\s*return/)
    const submitAt = src.search(/async function (submitForm|onSubmit)|const handleSubmit = async/)
    assert.ok(submitAt >= 0, `${name} must have a submit handler`)
    const submitSlice = src.slice(submitAt)
    const tokenIdx = submitSlice.indexOf('resolveSubmitCaptchaToken')
    const postIdx = submitSlice.indexOf('postJsonLead')
    assert.ok(tokenIdx >= 0 && postIdx > tokenIdx, `${name} must resolve token before POST`)
    const sanCall = extractCall(submitSlice, 'sanitizePayload')
    assert.ok(sanCall, `${name} must sanitize user fields`)
    assert.doesNotMatch(sanCall, /_recaptchaToken/, `${name} must not put the token through sanitizePayload`)
    const sanEnd = submitSlice.indexOf(sanCall) + sanCall.length
    const rawTok = submitSlice.indexOf('_recaptchaToken: captcha.token', sanEnd)
    assert.ok(rawTok > sanEnd, `${name} must append captcha.token after sanitizePayload`)
    assert.ok(postIdx > rawTok, `${name} must POST after attaching the raw token`)
  }

  const box = read('components/ui/RecaptchaBox.jsx')
  assert.match(box, /loadRecaptcha\(/)
  assert.doesNotMatch(box, /getRecaptchaToken\(/)
  assert.doesNotMatch(box, /90_000|90000|setInterval/)
  assert.match(box, /Geschützt durch reCAPTCHA/)
  assert.doesNotMatch(box, /enterprise\.js|grecaptcha\.enterprise/)
  assert.match(box, /hasVisibleRecaptchaSiteKey/)

  const security = read('lib/security.js')
  assert.match(security, /grecaptcha\.enterprise\.ready|enterprise\.js\?render=/)
  assert.match(security, /grecaptcha\.enterprise/)
  assert.match(security, /enterprise\.execute/)
  assert.doesNotMatch(security, /recaptcha\/api\.js\?render=\$\{/)
  assert.doesNotMatch(security, /console\.(log|info|debug|error|warn)\([^)]*token/)

  console.log('P0_RECAPTCHA_FORM_FLOW=PASS')
}

async function assertServerDiagnostics() {
  const logs = await captureLogs(async () => {
    await withEnv(
      {
        ...ENTERPRISE_ENV,
        RECAPTCHA_SECRET_KEY: SECRET,
        LEADS_RATE_LIMIT_SALT: 'p0-salt',
        LEADS_RATE_LIMIT_PROVIDER: 'memory',
      },
      async () => {
        const google = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: assessmentFetch(
            assessmentPayload({ valid: false, invalidReason: 'MALFORMED' }),
            { expectedAction: 'unternehmen' },
          ),
        })
        assert.equal(google.ok, false)
        assert.equal(google.code, 'captcha-rejected')
        assert.equal(google.reason, 'captcha-google-rejected')
        assert.equal(publicCaptchaErrorCode(google), 'captcha-rejected')
        assert.equal(google.diagnostics.valid, false)
        assert.equal(google.diagnostics.invalidReason, 'MALFORMED')
        assert.equal(google.diagnostics.expectedAction, 'unternehmen')

        const secretLabels = captchaDiagnosticsFromAssessment({
          tokenProperties: {
            valid: false,
            invalidReason: 'MALFORMED',
            hostname: TOKEN,
          },
          riskAnalysis: {
            reasons: ['AUTOMATION', 'not-a-real-provider-code', TOKEN, SECRET, API_KEY],
          },
        }, 'unternehmen')
        assert.equal(secretLabels.invalidReason, 'MALFORMED')
        assert.deepEqual(secretLabels.reasons, ['AUTOMATION'])
        assert.equal(secretLabels.reasons.includes('not-a-real-provider-code'), false)
        assert.ok(GOOGLE_ASSESSMENT_INVALID_REASONS.includes('MALFORMED'))
        assert.ok(GOOGLE_ASSESSMENT_RISK_REASONS.includes('AUTOMATION'))
        const allOfficial = captchaDiagnosticsFromAssessment({
          tokenProperties: { valid: false, invalidReason: TOKEN },
          riskAnalysis: { reasons: [...GOOGLE_ASSESSMENT_RISK_REASONS, 'browser-error', TOKEN] },
        })
        assert.equal(allOfficial.invalidReason, null)
        assert.deepEqual(allOfficial.reasons, [...GOOGLE_ASSESSMENT_RISK_REASONS])

        const pass = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: assessmentFetch(assessmentPayload(), { expectedAction: 'unternehmen' }),
        })
        assert.equal(pass.ok, true)
        assert.equal(pass.diagnostics.valid, true)
        assert.equal(pass.diagnostics.score, 0.9)

        const score = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: assessmentFetch(assessmentPayload({ score: 0.1 }), { expectedAction: 'unternehmen' }),
        })
        assert.equal(score.ok, false)
        assert.equal(score.reason, 'captcha-score-too-low')
        assert.equal(score.code, 'captcha-rejected')

        await withEnv({ RECAPTCHA_MIN_SCORE: undefined }, async () => {
          assert.equal(recaptchaMinScore(), 0.5)
        })
        await withEnv({ RECAPTCHA_MIN_SCORE: '0.7' }, async () => {
          assert.equal(recaptchaMinScore(), 0.7)
        })
        for (const invalid of ['abc', 'NaN', '-0.1', '1.1', 'Infinity']) {
          await withEnv({ RECAPTCHA_MIN_SCORE: invalid }, async () => {
            assert.equal(recaptchaMinScore(), null)
            let called = false
            const invalidConfig = await verifyCaptchaToken(TOKEN, {
              expectedAction: 'unternehmen',
              fetchImpl: async () => {
                called = true
                throw new Error('must-not-call-google')
              },
            })
            assert.equal(invalidConfig.ok, false)
            assert.equal(invalidConfig.code, 'captcha-not-configured')
            assert.equal(invalidConfig.reason, 'captcha-not-configured')
            assert.equal(called, false, 'invalid threshold must fail before Google request')
          })
        }

        await withEnv({ RECAPTCHA_VERIFY_TIMEOUT_MS: undefined }, async () => {
          assert.equal(recaptchaVerifyTimeoutMs(), 5000)
        })
        await withEnv({ RECAPTCHA_VERIFY_TIMEOUT_MS: '2500' }, async () => {
          assert.equal(recaptchaVerifyTimeoutMs(), 2500)
        })
        for (const invalid of ['abc', '99', '15001', '100.5']) {
          await withEnv({ RECAPTCHA_VERIFY_TIMEOUT_MS: invalid }, async () => {
            assert.equal(recaptchaVerifyTimeoutMs(), null)
            let called = false
            const invalidConfig = await verifyCaptchaToken(TOKEN, {
              expectedAction: 'unternehmen',
              fetchImpl: async () => {
                called = true
                throw new Error('must-not-call-google')
              },
            })
            assert.equal(invalidConfig.ok, false)
            assert.equal(invalidConfig.code, 'captcha-not-configured')
            assert.equal(called, false, 'invalid timeout must fail before Google request')
          })
        }

        await withEnv({ RECAPTCHA_VERIFY_TIMEOUT_MS: '100' }, async () => {
          let sawSignal = false
          let aborted = false
          const timedOut = await verifyCaptchaToken(TOKEN, {
            expectedAction: 'unternehmen',
            fetchImpl: async (_url, init = {}) =>
              new Promise((_resolve, reject) => {
                const signal = init.signal
                sawSignal = Boolean(signal)
                if (!signal) {
                  reject(new Error('missing-abort-signal'))
                  return
                }
                if (signal.aborted) {
                  aborted = true
                  reject(new Error('aborted'))
                  return
                }
                signal.addEventListener('abort', () => {
                  aborted = true
                  reject(new Error('aborted'))
                }, { once: true })
              }),
          })
          assert.equal(sawSignal, true)
          assert.equal(aborted, true)
          assert.equal(timedOut.ok, false)
          assert.equal(timedOut.code, 'captcha-verify-failed')
          assert.equal(timedOut.reason, 'captcha-verify-failed')
          assert.equal(timedOut.upstream?.transportError, true)
        })

        const action = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: assessmentFetch(assessmentPayload({ action: 'career' }), { expectedAction: 'unternehmen' }),
        })
        assert.equal(action.ok, false)
        assert.equal(action.reason, 'captcha-action-mismatch')

        const host = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: assessmentFetch(assessmentPayload({ hostname: 'evil.example' }), { expectedAction: 'unternehmen' }),
        })
        assert.equal(host.ok, false)
        assert.equal(host.reason, 'captcha-hostname-mismatch')

        const verifyFail = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: async () => {
            throw new Error('network')
          },
        })
        assert.equal(verifyFail.ok, false)
        assert.equal(verifyFail.code, 'captcha-verify-failed')
        assert.equal(verifyFail.reason, 'captcha-verify-failed')

        await withEnv(
          {
            RECAPTCHA_PROJECT_ID: undefined,
            RECAPTCHA_API_KEY: undefined,
            NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: undefined,
            RECAPTCHA_SECRET_KEY: SECRET,
            LEADS_RUNTIME_ENV: 'production',
          },
          async () => {
            const missing = await verifyCaptchaToken(TOKEN)
            assert.equal(missing.ok, false)
            assert.equal(missing.code, 'captcha-not-configured')
            assert.equal(missing.reason, 'captcha-not-configured')
          },
        )

        resetRateLimitsForTests()
        const prev = globalThis.fetch
        globalThis.fetch = assessmentFetch(
          assessmentPayload({ valid: false, invalidReason: 'MALFORMED', reasons: ['AUTOMATION', 'not-a-real-provider-code'] }),
          { expectedAction: 'unternehmen' },
        )
        try {
          const secretRejected = await enforcePublicIntake(
            jsonRequest({
              page_source: 'unternehmen',
              _recaptchaToken: TOKEN,
              _recaptchaAction: 'career',
            }),
            { endpoint: 'leads' },
          )
          assert.equal(secretRejected.ok, false)
          assert.equal(secretRejected.code, 'captcha-rejected')
        } finally {
          globalThis.fetch = prev
        }

        resetRateLimitsForTests()
        globalThis.fetch = assessmentFetch(
          assessmentPayload({ valid: false, invalidReason: 'EXPIRED' }),
          { expectedAction: 'unternehmen' },
        )
        try {
          const intake = await enforcePublicIntake(
            jsonRequest({
              page_source: 'unternehmen',
              _recaptchaToken: TOKEN,
              _recaptchaAction: 'career',
            }),
            { endpoint: 'leads' },
          )
          assert.equal(intake.ok, false)
          assert.equal(intake.code, 'captcha-rejected')
          assert.equal(intake.status, 403)
        } finally {
          globalThis.fetch = prev
        }

        resetRateLimitsForTests()
        globalThis.fetch = assessmentFetch(assessmentPayload(), { expectedAction: 'unternehmen' })
        try {
          const ok = await enforcePublicIntake(
            jsonRequest({
              page_source: 'unternehmen',
              _recaptchaToken: TOKEN,
              _recaptchaAction: 'career',
            }),
            { endpoint: 'leads' },
          )
          assert.equal(ok.ok, true, 'client telemetry action must remain ignored')
        } finally {
          globalThis.fetch = prev
        }
      },
    )
  })

  assert.match(logs.lines, /captcha-google-rejected|intake\.captcha_rejected/)
  assert.match(logs.lines, /MALFORMED/)
  assert.doesNotMatch(logs.lines, /not-a-real-provider-code/)
  assertNoSecretOrTokenLeak(logs.lines)
  assert.doesNotMatch(logs.lines, /203\.\d+\.\d+\.\d+/)

  const hero = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'hero-funnel' })
  assert.equal(hero.expectedAction, 'hero_funnel')
  const funnel = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'main_funnel' })
  assert.equal(funnel.expectedAction, 'main_funnel')
  const business = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'unternehmen' })
  assert.equal(business.expectedAction, 'unternehmen')
  const career = resolveExpectedCaptchaAction({ endpoint: 'careers', pageSource: 'career' })
  assert.equal(career.expectedAction, 'career')

  const intakeSrc = read('lib/leads/intake-guard.js')
  assert.match(intakeSrc, /telemetry only/)
  assert.doesNotMatch(intakeSrc, /expectedAction:\s*raw\._recaptchaAction/)
  assert.match(intakeSrc, /leadsLog/)

  const captchaSrc = read('lib/leads/captcha.js')
  assert.match(captchaSrc, /captcha-google-rejected/)
  assert.match(captchaSrc, /captcha-score-too-low/)
  assert.match(captchaSrc, /captcha-action-mismatch/)
  assert.match(captchaSrc, /captcha-hostname-mismatch/)

  console.log('P0_RECAPTCHA_SERVER_DIAGNOSTICS=PASS')
}

async function assertVisibleV2Compatibility() {
  await withEnv(
    {
      NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY,
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY: undefined,
    },
    async () => {
      assert.equal(hasVisibleRecaptchaSiteKey(), false)
      assert.equal(hasStandardV3SiteKey(), true)
      resetRecaptchaClientForTests()
      const { scripts } = installBrowserMocks()
      delete globalThis.grecaptcha
      const pending = resolveSubmitCaptchaToken('hero_funnel', 'ignored-visible-token-xxxxxxxxxx')
      const state = readyGrecaptcha()
      fireScriptLoad(scripts[0])
      const minted = await pending
      assert.equal(minted.ok, true)
      assert.equal(minted.mode, 'v3')
      assert.match(minted.token, /hero_funnel/)
      assert.equal(state.executeCalls.length, 1)
      assert.equal(state.executeCalls[0].opts.action, 'hero_funnel')
    },
  )

  await withEnv(
    {
      NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY,
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY: 'visible-v2-site-key',
    },
    async () => {
      assert.equal(hasVisibleRecaptchaSiteKey(), true)
      resetRecaptchaClientForTests()
      installBrowserMocks()
      const state = readyGrecaptcha()
      const visible = 'visible-v2-callback-token-xxxxxxxxxx'
      const resolved = await resolveSubmitCaptchaToken('hero_funnel', visible)
      assert.equal(resolved.ok, true)
      assert.equal(resolved.mode, 'visible_v2')
      assert.equal(resolved.token, visible)
      assert.equal(state.executeCalls.length, 0, 'visible v2 must not call v3 execute')

      const missing = await resolveSubmitCaptchaToken('hero_funnel', '')
      assert.equal(missing.ok, false)
      assert.equal(missing.mode, 'visible_v2')
      assert.equal(state.executeCalls.length, 0)
    },
  )

  const envExample = read('.env.example')
  assert.doesNotMatch(envExample, /^NEXT_PUBLIC_RECAPTCHA_SITE_KEY=/m)
  assert.match(envExample, /NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY/)
  assert.match(envExample, /RECAPTCHA_PROJECT_ID/)
  assert.match(envExample, /RECAPTCHA_API_KEY/)
  console.log('P0_RECAPTCHA_V2_COMPAT=PASS')
}

async function assertSiteKeyMatchReuse() {
  await withEnv({ NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY }, async () => {
    assert.equal(
      isCurrentV3ScriptSrc(`https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`, SITE_KEY),
      true,
    )
    assert.equal(
      isCurrentV3ScriptSrc(`https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`, SITE_KEY),
      false,
    )
    assert.equal(
      isCurrentV3ScriptSrc('https://www.google.com/recaptcha/enterprise.js?render=old-other-key', SITE_KEY),
      false,
    )
    assert.equal(
      isCurrentV3ScriptSrc('https://www.google.com/recaptcha/api.js?render=explicit', SITE_KEY),
      false,
    )
    assert.equal(
      isConflictingV3ScriptSrc('https://www.google.com/recaptcha/api.js?render=old-other-key', SITE_KEY),
      true,
    )
    assert.equal(
      isConflictingV3ScriptSrc(`https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`, SITE_KEY),
      true,
    )
    assert.equal(
      isConflictingV3ScriptSrc('https://www.google.com/recaptcha/enterprise.js?render=old-other-key', SITE_KEY),
      true,
    )
    assert.equal(
      isConflictingV3ScriptSrc(`https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`, SITE_KEY),
      false,
    )
    assert.equal(
      isConflictingV3ScriptSrc('https://www.google.com/recaptcha/api.js?render=explicit', SITE_KEY),
      false,
    )

    resetRecaptchaClientForTests()
    const matching = installBrowserMocks()
    const keep = document.createElement('script')
    keep.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`
    keep.setAttribute('data-recaptcha-v3', '1')
    document.head.appendChild(keep)
    readyGrecaptcha()
    await loadRecaptcha()
    assert.equal(matching.scripts.length, 1, 'matching enterprise site key script must be reused')

    resetRecaptchaClientForTests()
    const other = installBrowserMocks()
    const stale = document.createElement('script')
    stale.src = 'https://www.google.com/recaptcha/enterprise.js?render=old-other-key'
    stale.setAttribute('data-recaptcha-v3', '1')
    document.head.appendChild(stale)
    await assert.rejects(
      loadRecaptcha(),
      (err) => err instanceof RecaptchaClientError && err.code === 'recaptcha-script-mismatch',
    )
    assert.equal(other.scripts.length, 1, 'mismatched site key script must never be reused or duplicated')

    resetRecaptchaClientForTests()
    const explicit = installBrowserMocks()
    const v2 = document.createElement('script')
    v2.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    document.head.appendChild(v2)
    delete globalThis.grecaptcha
    const explicitLoad = loadRecaptcha()
    readyGrecaptcha()
    fireScriptLoad(explicit.scripts[1])
    await explicitLoad
    assert.equal(explicit.scripts.length, 2)
    assert.match(explicit.scripts[1].src, /recaptcha\/enterprise\.js\?render=/)
    assert.match(explicit.scripts[1].src, new RegExp(`render=${SITE_KEY}`))
    assert.doesNotMatch(explicit.scripts[1].src, /render=explicit/)

    resetRecaptchaClientForTests()
    const legacy = installBrowserMocks()
    const legacyV3 = document.createElement('script')
    legacyV3.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
    document.head.appendChild(legacyV3)
    await assert.rejects(
      loadRecaptcha(),
      (err) => err instanceof RecaptchaClientError && err.code === 'recaptcha-script-mismatch',
    )
    assert.equal(legacy.scripts.length, 1, 'legacy api.js v3 must not be reused or paired with enterprise.js')
  })
  console.log('P0_RECAPTCHA_SITE_KEY_MATCH=PASS')
}

function extractCall(src, name) {
  const start = src.indexOf(`${name}(`)
  if (start < 0) return ''
  let i = start + name.length + 1
  let depth = 1
  while (i < src.length && depth > 0) {
    const ch = src[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    i += 1
  }
  return src.slice(start, i)
}

async function assertTokenBytePreservation() {
  const minted = '  <tok>javascript:data:onerror=1-execute-token-xxxxxxxxxx  '
  assert.notEqual(sanitizeString(minted), minted, 'fixture must be a string sanitizeString would mutate')
  assert.notEqual(
    sanitizePayload({ _recaptchaToken: minted })._recaptchaToken,
    minted,
    'sanitizePayload would mutate a token if it were included',
  )

  await withEnv({ NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY: SITE_KEY, NEXT_PUBLIC_RECAPTCHA_SITE_KEY: undefined }, async () => {
    resetRecaptchaClientForTests()
    const { scripts } = installBrowserMocks()
    delete globalThis.grecaptcha
    const pending = resolveSubmitCaptchaToken('hero_funnel', '')
    readyGrecaptcha({ execute: async () => minted })
    fireScriptLoad(scripts[0])
    const resolved = await pending
    assert.equal(resolved.ok, true)
    assert.equal(resolved.token, minted, 'token from execute() must be unchanged')

    const posted = {
      ...sanitizePayload({ email: 'user@example.invalid', _recaptchaAction: 'hero_funnel' }),
      _recaptchaToken: resolved.token,
    }
    assert.equal(posted._recaptchaToken, minted)
    assert.equal(posted._recaptchaToken, resolved.token)
    assert.equal(posted.email, 'user@example.invalid')
  })

  for (const rel of Object.values(FORM_FILES)) {
    const src = read(rel)
    const submitAt = src.search(/async function (submitForm|onSubmit)|const handleSubmit = async/)
    const submitSlice = src.slice(submitAt)
    const sanCall = extractCall(submitSlice, 'sanitizePayload')
    assert.doesNotMatch(sanCall, /_recaptchaToken/)
    assert.match(submitSlice, /\.\.\.sanitizePayload\(/)
    assert.match(submitSlice, /_recaptchaToken:\s*captcha\.token/)
  }
  console.log('P0_RECAPTCHA_TOKEN_BYTE_PRESERVATION=PASS')
}

function assertErrorUx() {
  assert.equal(isCaptchaPublicCode('captcha-rejected'), true)
  const captcha = mapLeadSubmitUserMessage({ status: 403, code: 'captcha-rejected' }, { tone: 'informal' })
  assert.match(captcha, /Captcha/)
  assert.doesNotMatch(captcha, /Verbindung/)
  const rate = mapLeadSubmitUserMessage({ status: 429, code: 'too-many-requests' }, { tone: 'informal' })
  assert.match(rate, /viele Anfragen|warte/i)
  const validation = mapLeadSubmitUserMessage({ status: 400, code: 'invalid-payload' }, { tone: 'informal' })
  assert.match(validation, /Angaben/)
  const storage = mapLeadSubmitUserMessage({ status: 500, code: 'storage-failed' }, { tone: 'informal' })
  assert.match(storage, /gespeichert|später|Minuten/i)
  const network = mapLeadSubmitUserMessage({ thrown: new TypeError('Failed to fetch') }, { tone: 'informal' })
  assert.match(network, /Verbindung/)
  const formal = mapLeadSubmitUserMessage({ status: 403, code: 'captcha-rejected' }, { tone: 'formal' })
  assert.match(formal, /Sie|Ihre|Captcha/)
  const generic = mapLeadSubmitUserMessage({ status: 418, code: 'unknown-teapot' }, { tone: 'informal' })
  assert.doesNotMatch(generic, /Verbindung/)
  console.log('P0_RECAPTCHA_ERROR_UX=PASS')
}

function assertRegressionGuards() {
  assert.equal(customerMailDualGuardOpen(), false)
  const envExample = read('.env.example')
  assert.match(envExample, /ALLOW_CUSTOMER_MAIL=NO/)
  assert.doesNotMatch(envExample, /^ALLOW_CUSTOMER_MAIL=YES$/m)

  const cors = read('lib/leads/cors.js')
  assert.match(cors, /exact allowlist|Restrictive CORS/i)
  assert.doesNotMatch(cors, /Access-Control-Allow-Origin': '\*'/)
  assert.doesNotMatch(cors, /\*\\.vercel\\.app/)
  assert.equal(allowedOrigins().includes('*'), false)

  const leadsRoute = read('app/api/leads/route.js')
  assert.match(leadsRoute, /findLeadByIdempotencyKey/)
  assert.match(leadsRoute, /idempotency_key/)
  assert.match(leadsRoute, /insertLead/)
  const careersRoute = read('app/api/careers/route.js')
  assert.match(careersRoute, /enforcePublicIntake/)

  assert.doesNotMatch(read('lib/security.js'), /NEXT_PUBLIC_RECAPTCHA_SECRET|RECAPTCHA_SECRET_KEY|RECAPTCHA_API_KEY/)
  assert.doesNotMatch(envExample, /^NEXT_PUBLIC_RECAPTCHA_SITE_KEY=/m)
  console.log('P0_RECAPTCHA_REGRESSION_GUARDS=PASS')
}

async function main() {
  await assertLoadRecaptchaContract()
  await assertGetTokenContract()
  await assertFormTokenFlow()
  await assertTokenBytePreservation()
  await assertVisibleV2Compatibility()
  await assertSiteKeyMatchReuse()
  await assertServerDiagnostics()
  assertErrorUx()
  assertRegressionGuards()
  console.log('P0_RECAPTCHA_V3_FIX_TESTS=PASS')
  console.log('CUSTOMER_MAIL_ENABLED=NO')
  console.log('PRODUCTION_CHANGED=NO')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
