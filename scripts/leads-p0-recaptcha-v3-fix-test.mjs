#!/usr/bin/env node
/**
 * Standard reCAPTCHA v3 submit-contract proofs.
 * No production POST, no Checkdomain upload, no secret rotation, no customer mail.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowedOrigins } from '../lib/leads/cors.js'
import {
  publicCaptchaErrorCode,
  verifyCaptchaToken,
} from '../lib/leads/captcha.js'
import { resolveExpectedCaptchaAction } from '../lib/leads/captcha-action.js'
import { enforcePublicIntake } from '../lib/leads/intake-guard.js'
import { resetRateLimitsForTests } from '../lib/leads/abuse-guard.js'
import { customerMailDualGuardOpen } from '../lib/leads/mail.js'
import {
  RecaptchaClientError,
  getRecaptchaToken,
  loadRecaptcha,
  resetRecaptchaClientForTests,
} from '../lib/security.js'
import {
  awaitFreshRecaptchaToken,
  isCaptchaPublicCode,
  mapLeadSubmitUserMessage,
} from '../lib/leads/form-submit.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')
const SITE_KEY = 'test-public-site-key'
const TOKEN = 'token-from-browser-ok-12345'
const SECRET = 'rsecret-must-never-appear-in-logs'

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
      if (value.includes('recaptcha/api.js') && value.includes('render=')) {
        return scripts.find((s) => String(s.src).includes('recaptcha/api.js') && String(s.src).includes('render=')) || null
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

function siteverifyFetch(payload) {
  return async (url) => {
    assert.match(String(url), /recaptcha\/api\/siteverify/)
    assert.doesNotMatch(String(url), /recaptchaenterprise|assessments/)
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

function assertNoSecretOrTokenLeak(dump, token = TOKEN, secret = SECRET) {
  assert.doesNotMatch(dump, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(dump, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(dump, /RECAPTCHA_SECRET_KEY\s*[:=]/)
}

function readyGrecaptcha({ execute } = {}) {
  const state = { readyCalls: 0, executeCalls: [] }
  globalThis.grecaptcha = {
    ready(cb) {
      state.readyCalls += 1
      cb()
    },
    execute: execute || (async (siteKey, opts) => {
      state.executeCalls.push({ siteKey, opts })
      return `fresh-${state.executeCalls.length}-${opts.action}-xxxxxxxxxx`
    }),
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
      ready(cb) {
        queued.push(cb)
      },
    }
    globalThis.window.grecaptcha = globalThis.grecaptcha

    let resolved = false
    const pending = loadRecaptcha().then(() => {
      resolved = true
    })

    assert.equal(scripts.length, 1)
    assert.match(scripts[0].src, /recaptcha\/api\.js\?render=/)
    assert.doesNotMatch(scripts[0].src, /enterprise\.js/)
    assert.equal(scripts[0].attrs['data-recaptcha-v3'], '1')

    fireScriptLoad(scripts[0])
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(resolved, false, 'loadRecaptcha must wait for grecaptcha.ready()')

    globalThis.grecaptcha.execute = async () => 'not-used-xxxxxxxxxx'
    queued.forEach((cb) => cb())
    await pending
    assert.equal(resolved, true)
    assert.equal(typeof globalThis.grecaptcha.execute, 'function')

    resetRecaptchaClientForTests()
    const { scripts: concurrent } = installBrowserMocks()
    delete globalThis.grecaptcha
    const concurrentLoads = Promise.all([loadRecaptcha(), loadRecaptcha(), loadRecaptcha()])
    assert.equal(concurrent.length, 1, 'concurrent loadRecaptcha must inject one v3 script')
    assert.equal(document.querySelectorAll('script[src]').filter((s) => String(s.src).includes('recaptcha/api.js')).length, 1)
    readyGrecaptcha()
    fireScriptLoad(concurrent[0])
    await concurrentLoads

    resetRecaptchaClientForTests()
    const halfLoaded = installBrowserMocks()
    globalThis.grecaptcha = {
      ready(cb) {
        cb()
      },
    }
    globalThis.window.grecaptcha = globalThis.grecaptcha
    const missingExecute = loadRecaptcha()
    fireScriptLoad(halfLoaded.scripts[0])
    await assert.rejects(
      missingExecute,
      (err) => err instanceof RecaptchaClientError && err.code === 'recaptcha-execute-unavailable',
    )
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
      ready(cb) {
        cb()
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
    assert.match(src, /awaitFreshRecaptchaToken\(/)
    assert.match(src, new RegExp(`awaitFreshRecaptchaToken\\(\\s*'${expected.action}'\\s*\\)`))
    assert.match(src, new RegExp(`_recaptchaAction:\\s*'${expected.action}'`))
    assert.match(src, new RegExp(`page_source:\\s*'${expected.page}'`))
    assert.match(src, /_recaptchaToken:\s*captcha\.token/)
    assert.doesNotMatch(src, /const \[recaptchaToken,\s*setRecaptchaToken\]/)
    assert.doesNotMatch(src, /_recaptchaToken:\s*recaptchaToken/)
    assert.doesNotMatch(src, /90_000|90000/)
    assert.match(src, /mapLeadSubmitUserMessage/)
    assert.doesNotMatch(src, /Bitte prüfe deine Verbindung und versuche es erneut/)
    assert.doesNotMatch(src, /Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut/)
    assert.match(src, /if\s*\(\s*!captcha\.ok\s*\)/)
    const submitAt = src.search(/async function (submitForm|onSubmit)|const handleSubmit = async/)
    assert.ok(submitAt >= 0, `${name} must have a submit handler`)
    const submitSlice = src.slice(submitAt)
    const tokenIdx = submitSlice.indexOf('awaitFreshRecaptchaToken')
    const postIdx = submitSlice.indexOf('postJsonLead')
    assert.ok(tokenIdx >= 0 && postIdx > tokenIdx, `${name} must mint token before POST`)
  }

  const box = read('components/ui/RecaptchaBox.jsx')
  assert.match(box, /loadRecaptcha\(/)
  assert.doesNotMatch(box, /getRecaptchaToken\(/)
  assert.doesNotMatch(box, /90_000|90000|setInterval/)
  assert.match(box, /Geschützt durch reCAPTCHA/)
  assert.doesNotMatch(box, /enterprise\.js|grecaptcha\.enterprise/)
  assert.match(box, /hasVisibleRecaptchaSiteKey/)

  const security = read('lib/security.js')
  assert.match(security, /grecaptcha\.ready/)
  assert.match(security, /typeof window\.grecaptcha\.execute === 'function'|typeof[\s\S]{0,80}execute === 'function'/)
  assert.doesNotMatch(security, /google\.com\/recaptcha\/enterprise|grecaptcha\.enterprise\.execute/)
  assert.doesNotMatch(security, /console\.(log|info|debug|error|warn)\([^)]*token/)

  console.log('P0_RECAPTCHA_FORM_FLOW=PASS')
}

async function assertServerDiagnostics() {
  const logs = await captureLogs(async () => {
    await withEnv(
      {
        RECAPTCHA_SECRET_KEY: SECRET,
        LEADS_RATE_LIMIT_SALT: 'p0-salt',
        LEADS_RATE_LIMIT_PROVIDER: 'memory',
      },
      async () => {
        const google = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: siteverifyFetch({
            success: false,
            'error-codes': ['invalid-input-response'],
            hostname: 'www.deintarifheld.de',
          }),
        })
        assert.equal(google.ok, false)
        assert.equal(google.code, 'captcha-rejected')
        assert.equal(google.reason, 'captcha-google-rejected')
        assert.equal(publicCaptchaErrorCode(google), 'captcha-rejected')
        assert.deepEqual(google.diagnostics.error_codes, ['invalid-input-response'])

        const score = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: siteverifyFetch({
            success: true,
            hostname: 'www.deintarifheld.de',
            score: 0.1,
            action: 'unternehmen',
          }),
        })
        assert.equal(score.ok, false)
        assert.equal(score.reason, 'captcha-score-too-low')
        assert.equal(score.code, 'captcha-rejected')

        const action = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: siteverifyFetch({
            success: true,
            hostname: 'www.deintarifheld.de',
            score: 0.9,
            action: 'career',
          }),
        })
        assert.equal(action.ok, false)
        assert.equal(action.reason, 'captcha-action-mismatch')

        const host = await verifyCaptchaToken(TOKEN, {
          expectedAction: 'unternehmen',
          fetchImpl: siteverifyFetch({
            success: true,
            hostname: 'evil.example',
            score: 0.9,
            action: 'unternehmen',
          }),
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

        await withEnv({ RECAPTCHA_SECRET_KEY: undefined, LEADS_RUNTIME_ENV: 'production' }, async () => {
          const missing = await verifyCaptchaToken(TOKEN)
          assert.equal(missing.ok, false)
          assert.equal(missing.code, 'captcha-not-configured')
          assert.equal(missing.reason, 'captcha-not-configured')
        })

        resetRateLimitsForTests()
        const prev = globalThis.fetch
        globalThis.fetch = siteverifyFetch({
          success: false,
          'error-codes': ['timeout-or-duplicate'],
        })
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
        globalThis.fetch = siteverifyFetch({
          success: true,
          hostname: 'www.deintarifheld.de',
          score: 0.9,
          action: 'unternehmen',
        })
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

  assert.doesNotMatch(read('lib/security.js'), /NEXT_PUBLIC_RECAPTCHA_SECRET|RECAPTCHA_SECRET_KEY/)
  console.log('P0_RECAPTCHA_REGRESSION_GUARDS=PASS')
}

async function main() {
  await assertLoadRecaptchaContract()
  await assertGetTokenContract()
  await assertFormTokenFlow()
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
