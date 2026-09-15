#!/usr/bin/env node
/**
 * Phase 2 P0 security regression — no network to production, no real customer mail,
 * no production lead writes. Google siteverify and Resend are mocked when used.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAdminAuthorized } from '../lib/leads/admin-auth.js'
import { isCronAuthorized } from '../lib/leads/cron-auth.js'
import { createAdminSessionValue, parseAdminSessionValue, ADMIN_COOKIE_NAME } from '../lib/leads/admin-session.js'
import { enforceAdminAccess } from '../lib/leads/admin-guard.js'
import {
  evaluateFormTiming,
  hasControlledIntakeBypass,
  isBlockedOrigin,
  isTooFastSubmit,
  resetRateLimitsForTests,
} from '../lib/leads/abuse-guard.js'
import { captchaRequired, verifyCaptchaToken } from '../lib/leads/captcha.js'
import { enforcePublicIntake } from '../lib/leads/intake-guard.js'
import { readJsonBody, MAX_LEAD_BODY_BYTES } from '../lib/leads/read-json-body.js'
import { allowedOrigins, corsHeaders } from '../lib/leads/cors.js'
import { API_SECURITY_HEADERS, INBOX_SECURITY_HEADERS } from '../lib/leads/security-headers.js'
import { isSecretStrong, safeEqualString } from '../lib/leads/secret-compare.js'
import { customerMailDualGuardOpen, sendLeadEmails } from '../lib/leads/mail.js'
import { publicCareersHealth, publicLeadsHealth } from '../lib/leads/public-health.js'
import { inboxGetResponse } from '../lib/leads/admin-inbox-http.js'
import { withCors } from '../lib/leads/cors.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const STRONG_ADMIN = 'p0-admin-secret-value-32chars!!'
const STRONG_CRON = 'p0-cron-secret-value-32chars!!!'

function fakeRequest(headers = {}, url = 'https://deintarifheld-leads-api.vercel.app/api/leads/') {
  const headerMap = {}
  for (const [k, v] of Object.entries(headers)) headerMap[k.toLowerCase()] = v
  return {
    url,
    headers: {
      get(name) {
        return headerMap[name.toLowerCase()] ?? null
      },
    },
  }
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

function jsonRequest({ origin, referer, body, contentLength, extraHeaders = {} }) {
  const encoded = typeof body === 'string' ? body : JSON.stringify(body ?? {})
  const headers = {
    'content-type': 'application/json',
    ...extraHeaders,
  }
  if (origin) headers.origin = origin
  if (referer) headers.referer = referer
  if (contentLength !== undefined) headers['content-length'] = String(contentLength)
  return new Request('https://deintarifheld-leads-api.vercel.app/api/leads/', {
    method: 'POST',
    headers,
    body: encoded,
  })
}

async function assertCaptcha() {
  await withEnv({ RECAPTCHA_SECRET_KEY: undefined, LEADS_RUNTIME_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    assert.equal(captchaRequired(), false)
  })
  await withEnv({ RECAPTCHA_SECRET_KEY: 'rsecret', LEADS_RUNTIME_ENV: undefined }, async () => {
    assert.equal(captchaRequired(), true)
    const missing = await verifyCaptchaToken('')
    assert.equal(missing.ok, false)
    assert.equal(missing.code, 'captcha-invalid')
  })
  await withEnv({ RECAPTCHA_SECRET_KEY: undefined, LEADS_RUNTIME_ENV: 'production' }, async () => {
    assert.equal(captchaRequired(), true)
    const none = await verifyCaptchaToken('x'.repeat(40))
    assert.equal(none.ok, false)
    assert.equal(none.code, 'captcha-not-configured')
  })

  const calls = []
  const fakeFetch = async (url, init) => {
    calls.push({ url: String(url), body: String(init.body) })
    return new Response(JSON.stringify({ success: true, hostname: 'www.deintarifheld.de', score: 0.9 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  await withEnv({ RECAPTCHA_SECRET_KEY: 'rsecret', LEADS_RUNTIME_ENV: 'production' }, async () => {
    const ok = await verifyCaptchaToken('token-from-browser-ok-12345', { fetchImpl: fakeFetch })
    assert.equal(ok.ok, true)
    assert.match(calls[0].url, /siteverify/)
    assert.match(calls[0].body, /secret=rsecret/)
  })

  const rejectFetch = async () =>
    new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  await withEnv({ RECAPTCHA_SECRET_KEY: 'rsecret' }, async () => {
    const bad = await verifyCaptchaToken('token-from-browser-bad-12345', { fetchImpl: rejectFetch })
    assert.equal(bad.ok, false)
    assert.equal(bad.code, 'captcha-rejected')
  })

  await withEnv(
    {
      RECAPTCHA_SECRET_KEY: 'rsecret',
      LEADS_RUNTIME_ENV: undefined,
      LEADS_RATE_LIMIT_SALT: 'p0-salt',
      LEADS_RATE_LIMIT_PROVIDER: 'memory',
    },
    async () => {
      resetRateLimitsForTests()
      const result = await enforcePublicIntake(
        jsonRequest({
          origin: 'https://www.deintarifheld.de',
          body: { email: 'x@example.invalid' },
        }),
      )
      assert.equal(result.ok, false)
      assert.equal(result.code, 'captcha-invalid')
      assert.equal(result.status, 403)
    },
  )
  console.log('P0_CAPTCHA=PASS')
}

async function assertOrigin() {
  await withEnv({ LEADS_RUNTIME_ENV: 'production', LEADS_ALLOWED_ORIGINS: 'http://localhost:3000' }, () => {
    assert.equal(allowedOrigins().includes('http://localhost:3000'), false)
    assert.equal(allowedOrigins().includes('https://www.deintarifheld.de'), true)
    assert.equal(
      isBlockedOrigin(fakeRequest({})),
      true,
      'missing Origin/Referer must not be trusted',
    )
    assert.equal(isBlockedOrigin(fakeRequest({ origin: 'https://evil.example' })), true)
    assert.equal(isBlockedOrigin(fakeRequest({ origin: 'https://www.deintarifheld.de' })), false)
    assert.equal(
      isBlockedOrigin(fakeRequest({ referer: 'https://www.deintarifheld.de/unternehmen-neu/' })),
      false,
    )
  })

  await withEnv(
    {
      LEADS_RUNTIME_ENV: undefined,
      VERCEL_ENV: undefined,
      LEADS_ALLOW_SMOKE_BYPASS: 'YES',
      LEADS_INTAKE_SMOKE_SECRET: 'smoke-secret-16ch',
    },
    () => {
      assert.equal(
        hasControlledIntakeBypass(fakeRequest({ 'x-dth-intake-smoke': 'smoke-secret-16ch' })),
        true,
      )
      assert.equal(isBlockedOrigin(fakeRequest({ 'x-dth-intake-smoke': 'smoke-secret-16ch' })), false)
    },
  )

  await withEnv(
    {
      LEADS_RUNTIME_ENV: 'production',
      LEADS_ALLOW_SMOKE_BYPASS: 'YES',
      LEADS_INTAKE_SMOKE_SECRET: 'smoke-secret-16ch',
    },
    () => {
      assert.equal(
        hasControlledIntakeBypass(fakeRequest({ 'x-dth-intake-smoke': 'smoke-secret-16ch' })),
        false,
        'production must ignore smoke bypass',
      )
    },
  )
  console.log('P0_ORIGIN=PASS')
}

async function assertBodyLimit() {
  const oversized = 'x'.repeat(MAX_LEAD_BODY_BYTES + 50)
  const overDeclared = await readJsonBody(
    new Request('http://local/api/leads/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(MAX_LEAD_BODY_BYTES + 10) },
      body: JSON.stringify({ email: 'x@example.invalid' }),
    }),
  )
  assert.equal(overDeclared.ok, false)
  assert.equal(overDeclared.code, 'payload-too-large')

  const overStream = await readJsonBody(
    new Request('http://local/api/leads/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pad: oversized }),
    }),
  )
  assert.equal(overStream.ok, false)
  assert.equal(overStream.code, 'payload-too-large')

  const missingLen = await readJsonBody(
    new Request('http://local/api/leads/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ok@example.invalid' }),
    }),
  )
  assert.equal(missingLen.ok, true)
  assert.equal(missingLen.data.email, 'ok@example.invalid')
  console.log('P0_BODY_LIMIT=PASS')
}

function assertTiming() {
  assert.equal(isTooFastSubmit(undefined), true)
  assert.equal(isTooFastSubmit(''), true)
  assert.equal(isTooFastSubmit(Date.now()), true)
  assert.equal(isTooFastSubmit(Date.now() - 4000), false)
  assert.equal(evaluateFormTiming(Date.now() - 8 * 60 * 60 * 1000).reason, 'too-old')
  console.log('P0_TIMING=PASS')
}

async function assertAdminAuth() {
  await withEnv({ LEADS_ADMIN_SECRET: STRONG_ADMIN, CRON_SECRET: STRONG_CRON, LEADS_RUNTIME_ENV: undefined }, () => {
    assert.equal(isAdminAuthorized(fakeRequest({ authorization: `Bearer ${STRONG_ADMIN}` })), true)
    assert.equal(isAdminAuthorized(fakeRequest({ authorization: `Bearer ${STRONG_CRON}` })), false)
    assert.equal(isCronAuthorized(fakeRequest({ authorization: `Bearer ${STRONG_CRON}` })), true)
    assert.equal(isCronAuthorized(fakeRequest({ authorization: `Bearer ${STRONG_ADMIN}` })), false)
    assert.equal(isAdminAuthorized(fakeRequest({ authorization: `Bearer ${STRONG_ADMIN}?from=query` })), false)
    const session = createAdminSessionValue(STRONG_ADMIN)
    assert.equal(parseAdminSessionValue(STRONG_ADMIN, session), true)
    assert.equal(parseAdminSessionValue(STRONG_CRON, session), false)
    assert.equal(
      isAdminAuthorized(fakeRequest({ cookie: `${ADMIN_COOKIE_NAME}=${session}` })),
      true,
    )
  })

  await withEnv({ LEADS_ADMIN_SECRET: 'short', CRON_SECRET: 'tiny', LEADS_RUNTIME_ENV: 'production' }, () => {
    assert.equal(isSecretStrong('short'), false)
    assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer short' })), false)
    assert.equal(isCronAuthorized(fakeRequest({ authorization: 'Bearer tiny' })), false)
  })

  assert.equal(safeEqualString('abc', 'abc'), true)
  assert.equal(safeEqualString('abc', 'abd'), false)
  assert.equal(safeEqualString('abc', 'abcd'), false)
  console.log('P0_ADMIN_AUTH=PASS')
}

async function assertAdminBruteForceAndInbox() {
  await withEnv(
    {
      LEADS_ADMIN_SECRET: STRONG_ADMIN,
      CRON_SECRET: STRONG_CRON,
      LEADS_RATE_LIMIT_SALT: 'p0-admin-salt',
      LEADS_RATE_LIMIT_PROVIDER: 'memory',
      LEADS_RUNTIME_ENV: undefined,
    },
    async () => {
      resetRateLimitsForTests()
      const ipHeaders = { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'p0-test' }
      for (let i = 0; i < 5; i += 1) {
        const denied = await enforceAdminAccess(fakeRequest({ ...ipHeaders, authorization: 'Bearer wrong-secret-value' }))
        assert.equal(denied.ok, false)
        assert.equal(denied.status, 401)
      }
      const locked = await enforceAdminAccess(fakeRequest({ ...ipHeaders, authorization: `Bearer ${STRONG_ADMIN}` }))
      assert.equal(locked.ok, false)
      assert.equal(locked.status, 429)

      const inbox = inboxGetResponse(fakeRequest({}))
      assert.equal(inbox.status, 401)
      const inboxText = await inbox.text()
      assert.match(inboxText, /Ops-Geheimnis/)
      assert.doesNotMatch(inboxText, /sessionStorage/)
      assert.ok(inbox.headers.get('content-security-policy'))
      assert.ok(inbox.headers.get('strict-transport-security'))
      assert.ok(inbox.headers.get('x-frame-options'))

      const authedInbox = inboxGetResponse(fakeRequest({ authorization: `Bearer ${STRONG_ADMIN}` }))
      assert.equal(authedInbox.status, 200)
      const authedText = await authedInbox.text()
      assert.match(authedText, /credentials: 'same-origin'/)

      const adminData = await enforceAdminAccess(fakeRequest({}))
      assert.equal(adminData.ok, false)
      assert.equal(adminData.status, 401)

      assert.equal(isCronAuthorized(fakeRequest({ authorization: `Bearer ${STRONG_ADMIN}` })), false)
    },
  )
  console.log('P0_ADMIN_BRUTE_INBOX=PASS')
}

async function assertHeadersAndHealth() {
  const leadsJson = publicLeadsHealth()
  assert.equal(leadsJson.ok, true)
  assert.equal(Object.prototype.hasOwnProperty.call(leadsJson, 'mailModeDefault'), false)
  assert.doesNotMatch(JSON.stringify(leadsJson), /RESEND|SUPABASE|SECRET|internal_live|ALLOW_CUSTOMER/)
  const careersJson = publicCareersHealth()
  assert.equal(Object.prototype.hasOwnProperty.call(careersJson, 'mailModeDefault'), false)

  const response = new Response(JSON.stringify(leadsJson), { status: 200 })
  withCors(fakeRequest({ origin: 'https://www.deintarifheld.de' }), response)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.match(response.headers.get('strict-transport-security') || '', /max-age=31536000/)
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  assert.ok(response.headers.get('permissions-policy'))
  assert.ok(response.headers.get('content-security-policy'))
  assert.ok(response.headers.get('referrer-policy'))

  const cors = corsHeaders(fakeRequest({ origin: 'https://www.deintarifheld.de' }))
  assert.doesNotMatch(cors['Access-Control-Allow-Headers'] || '', /Authorization/i)
  assert.ok(API_SECURITY_HEADERS['Strict-Transport-Security'])
  assert.match(INBOX_SECURITY_HEADERS['Content-Security-Policy'], /script-src 'unsafe-inline'/)

  const htaccess = readFileSync(join(root, 'public/.htaccess'), 'utf8')
  assert.match(htaccess, /Strict-Transport-Security/)
  assert.match(htaccess, /Content-Security-Policy/)

  const leadsRoute = readFileSync(join(root, 'app/api/leads/route.js'), 'utf8')
  const careersRoute = readFileSync(join(root, 'app/api/careers/route.js'), 'utf8')
  assert.match(leadsRoute, /publicLeadsHealth/)
  assert.match(careersRoute, /publicCareersHealth/)
  assert.doesNotMatch(leadsRoute, /mailModeDefault/)
  assert.doesNotMatch(careersRoute, /mailModeDefault/)
  console.log('P0_HEADERS_HEALTH=PASS')
}

async function assertMailGuards() {
  assert.equal(customerMailDualGuardOpen(), false)
  await withEnv({ LEADS_MAIL_MODE: 'live', ALLOW_CUSTOMER_MAIL: 'YES' }, () => {
    assert.equal(customerMailDualGuardOpen(), true)
  })
  await withEnv({ LEADS_MAIL_MODE: 'internal_live', ALLOW_CUSTOMER_MAIL: 'YES' }, () => {
    assert.equal(customerMailDualGuardOpen(), false)
  })

  const originalFetch = globalThis.fetch
  const sends = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    if (!url.includes('api.resend.com')) throw new Error(`unexpected_fetch ${url}`)
    const body = init.body ? JSON.parse(init.body) : {}
    sends.push(body)
    return new Response(JSON.stringify({ id: 'email_p0' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    await withEnv(
      {
        LEADS_MAIL_MODE: 'internal_live',
        ALLOW_CUSTOMER_MAIL: 'YES',
        RESEND_API_KEY: 're_test',
        LEADS_FROM_EMAIL: 'DeinTarifheld <ops@example.invalid>',
        LEADS_TO_EMAIL: 'kontakt@deintarifheld.de',
      },
      async () => {
        sends.length = 0
        const r = await sendLeadEmails({
          leadRef: 'P0-INT',
          data: { email: 'customer@example.invalid', firma: 'P0' },
          submittedAt: new Date().toISOString(),
          channel: 'business',
        })
        assert.equal(r.customerConfirmation, 'skipped')
        assert.equal(sends.length, 1)
        assert.deepEqual(sends[0].to, ['kontakt@deintarifheld.de'])
      },
    )
    await withEnv(
      {
        LEADS_MAIL_MODE: 'not-a-mode',
        RESEND_API_KEY: 're_test',
        LEADS_FROM_EMAIL: 'DeinTarifheld <ops@example.invalid>',
        LEADS_TO_EMAIL: 'kontakt@deintarifheld.de',
      },
      async () => {
        sends.length = 0
        const r = await sendLeadEmails({
          leadRef: 'P0-BAD',
          data: { email: 'customer@example.invalid' },
          submittedAt: new Date().toISOString(),
          channel: 'business',
        })
        assert.equal(r.ok, false)
        assert.equal(r.code, 'mail-mode-unsupported')
        assert.equal(sends.length, 0)
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
  console.log('P0_MAIL_GUARDS=PASS')
}

async function main() {
  await assertCaptcha()
  await assertOrigin()
  await assertBodyLimit()
  assertTiming()
  await assertAdminAuth()
  await assertAdminBruteForceAndInbox()
  await assertHeadersAndHealth()
  await assertMailGuards()
  console.log('P0_SECURITY_TESTS=PASS')
  console.log('REAL_CUSTOMER_MAIL_SENT=NO')
  console.log('PRODUCTION_DATA_MUTATED=NO')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
