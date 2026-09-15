#!/usr/bin/env node
/**
 * PR #6 remediation proofs — no production writes, no real customer mail.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHmac } from 'node:crypto'
import {
  CAPTCHA_ACTION_HERO,
  CAPTCHA_PRODUCTION_VARIANT,
  CONFIGURED_V3_ACTIONS,
  GOOGLE_V3_ACTION_RE,
  assertConfiguredV3ActionsValid,
  isValidGoogleV3Action,
  resolveExpectedCaptchaAction,
} from '../lib/leads/captcha-action.js'
import { verifyCaptchaToken } from '../lib/leads/captcha.js'
import { enforcePublicIntake } from '../lib/leads/intake-guard.js'
import {
  consumeRateLimit,
  RATE_LIMIT_MAX_SUBMITS,
  resetRateLimitsForTests,
  setRateLimitSupabaseForTests,
} from '../lib/leads/rate-limit-provider.js'
import { hasRecaptchaEnterpriseSiteKey, getRecaptchaEnterpriseToken } from '../lib/security.js'
import {
  acceptOptionalProvenExpertConsent,
  essentialOnlyConsent,
  PROVENEXPERT_SCRIPT_URL,
  shouldLoadProvenExpertScript,
} from '../lib/consent/third-party.js'
import { anonymisePayload, ANONYMISED_EMAIL, emailAuditPseudonym } from '../lib/leads/retention-privacy.js'
import { processLeadDeletion } from '../lib/leads/supabase.js'
import { publicCareersHealth, publicLeadsHealth } from '../lib/leads/public-health.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

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

function jsonRequest({ origin = 'https://www.deintarifheld.de', body, url = 'https://deintarifheld-leads-api.vercel.app/api/leads/' }) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  })
}

const TOKEN = 'token-from-browser-ok-12345'

async function assertServerOwnedActionBinding() {
  const business = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'unternehmen' })
  assert.equal(business.ok, true)
  assert.equal(business.expectedAction, 'unternehmen')
  const career = resolveExpectedCaptchaAction({ endpoint: 'careers', pageSource: 'anything' })
  assert.equal(career.expectedAction, 'career')
  const hero = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'hero-funnel' })
  assert.equal(hero.expectedAction, 'hero_funnel')
  assert.equal(hero.expectedAction, CAPTCHA_ACTION_HERO)
  assert.ok(isValidGoogleV3Action(hero.expectedAction))
  assert.equal(isValidGoogleV3Action('hero-funnel'), false)
  assert.ok(GOOGLE_V3_ACTION_RE.test('hero_funnel'))
  assert.equal(GOOGLE_V3_ACTION_RE.test('hero-funnel'), false)
  assert.deepEqual(assertConfiguredV3ActionsValid(), { ok: true, invalid: [] })
  assert.ok(CONFIGURED_V3_ACTIONS.every((a) => isValidGoogleV3Action(a)))
  const privat = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'privat' })
  assert.ok(privat.allowedActions.includes('hero_funnel'))
  assert.ok(!privat.allowedActions.includes('hero-funnel'))
  assert.ok(privat.allowedActions.includes('main_funnel'))
  const wrongEp = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'career' })
  assert.equal(wrongEp.ok, false)

  const intakeSrc = read('lib/leads/intake-guard.js')
  assert.match(intakeSrc, /telemetry only/)
  assert.doesNotMatch(intakeSrc, /expectedAction:\s*action/)
  assert.doesNotMatch(intakeSrc, /expectedAction:\s*raw\._recaptchaAction/)

  await withEnv(
    {
      RECAPTCHA_SECRET_KEY: 'rsecret',
      LEADS_RATE_LIMIT_SALT: 'p0-salt',
      LEADS_RATE_LIMIT_PROVIDER: 'memory',
    },
    async () => {
      const ok = await verifyCaptchaToken(TOKEN, {
        expectedAction: 'unternehmen',
        fetchImpl: siteverifyFetch({
          success: true,
          hostname: 'www.deintarifheld.de',
          score: 0.9,
          action: 'unternehmen',
        }),
      })
      assert.equal(ok.ok, true, 'business vs business')

      const careerVsBiz = await verifyCaptchaToken(TOKEN, {
        expectedAction: 'unternehmen',
        fetchImpl: siteverifyFetch({
          success: true,
          hostname: 'www.deintarifheld.de',
          score: 0.9,
          action: 'career',
        }),
      })
      assert.equal(careerVsBiz.ok, false, 'career vs business')

      const privateVsCareer = await verifyCaptchaToken(TOKEN, {
        expectedAction: 'hero_funnel',
        fetchImpl: siteverifyFetch({
          success: true,
          hostname: 'www.deintarifheld.de',
          score: 0.9,
          action: 'career',
        }),
      })
      assert.equal(privateVsCareer.ok, false, 'private vs career')

      const missing = await verifyCaptchaToken(TOKEN, {
        expectedAction: 'unternehmen',
        fetchImpl: siteverifyFetch({
          success: true,
          hostname: 'www.deintarifheld.de',
          score: 0.9,
        }),
      })
      assert.equal(missing.ok, false, 'missing action when action-based')

      const host = await verifyCaptchaToken(TOKEN, {
        expectedAction: 'unternehmen',
        fetchImpl: siteverifyFetch({
          success: true,
          hostname: 'evil.example',
          score: 0.9,
          action: 'unternehmen',
        }),
      })
      assert.equal(host.ok, false, 'hostname mismatch')

      const score = await verifyCaptchaToken(TOKEN, {
        expectedAction: 'unternehmen',
        fetchImpl: siteverifyFetch({
          success: true,
          hostname: 'www.deintarifheld.de',
          score: 0.1,
          action: 'unternehmen',
        }),
      })
      assert.equal(score.ok, false, 'score below threshold')
    },
  )

  await withEnv(
    {
      RECAPTCHA_SECRET_KEY: 'rsecret',
      LEADS_RATE_LIMIT_SALT: 'p0-salt',
      LEADS_RATE_LIMIT_PROVIDER: 'memory',
    },
    async () => {
      resetRateLimitsForTests()
      const prev = globalThis.fetch
      globalThis.fetch = siteverifyFetch({
        success: true,
        hostname: 'www.deintarifheld.de',
        score: 0.9,
        action: 'unternehmen',
      })
      try {
        const result = await enforcePublicIntake(
          jsonRequest({
            body: {
              page_source: 'unternehmen',
              _recaptchaToken: TOKEN,
              _recaptchaAction: 'career',
            },
          }),
          { endpoint: 'leads' },
        )
        assert.equal(result.ok, true, 'client telemetry action must not override server expectation')
      } finally {
        globalThis.fetch = prev
      }
    },
  )

  console.log('P0_CAPTCHA_SERVER_ACTION=PASS')
}

async function assertEnterpriseVsStandard() {
  assert.equal(CAPTCHA_PRODUCTION_VARIANT, 'standard_v2_v3_siteverify')
  assert.equal(hasRecaptchaEnterpriseSiteKey(), false)
  assert.equal(await getRecaptchaEnterpriseToken('unternehmen'), null)

  const box = read('components/ui/RecaptchaBox.jsx')
  assert.doesNotMatch(box, /enterprise\.js|grecaptcha\.enterprise|ENTERPRISE_SITE_KEY/)
  const security = read('lib/security.js')
  assert.doesNotMatch(security, /recaptcha\/enterprise\.js|grecaptcha\.enterprise\.execute/)
  assert.match(security, /not a supported DTH production variant/)
  const captcha = read('lib/leads/captcha.js')
  assert.match(captcha, /siteverify/)
  assert.match(captcha, /www\.google\.com\/recaptcha\/api\/siteverify/)
  assert.doesNotMatch(captcha, /recaptchaenterprise\.googleapis\.com/)
  const envEx = read('.env.example')
  assert.match(envEx, /NOT a supported production variant/)
  console.log('P0_CAPTCHA_PROVIDER=PASS')
}

async function assertAtomicRateLimit() {
  await withEnv(
    {
      LEADS_RATE_LIMIT_PROVIDER: 'memory',
      LEADS_RATE_LIMIT_SALT: 'p0-salt',
      LEADS_RUNTIME_ENV: undefined,
    },
    async () => {
      resetRateLimitsForTests()
      const results = await Promise.all(
        Array.from({ length: 24 }, () => consumeRateLimit('parallel-key', 'submit')),
      )
      const allowed = results.filter((r) => r.allowed)
      const denied = results.filter((r) => !r.allowed)
      assert.equal(allowed.length, RATE_LIMIT_MAX_SUBMITS)
      assert.equal(denied.length, 24 - RATE_LIMIT_MAX_SUBMITS)
      assert.ok(denied.every((r) => r.hitCount > RATE_LIMIT_MAX_SUBMITS))
      const maxHit = Math.max(...results.map((r) => r.hitCount))
      assert.equal(maxHit, 24, 'no lost updates')
    },
  )

  let rpcHits = 0
  setRateLimitSupabaseForTests({
    rpc: async (name, args) => {
      assert.equal(name, 'consume_rate_limit')
      rpcHits += 1
      const hit = rpcHits
      return {
        data: [
          {
            allowed: hit <= args.p_max_hits,
            hit_count: hit,
            retry_after: hit <= args.p_max_hits ? 0 : 60,
          },
        ],
        error: null,
      }
    },
  })
  await withEnv({ LEADS_RATE_LIMIT_PROVIDER: 'supabase', LEADS_RATE_LIMIT_SALT: 'p0-salt' }, async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeRateLimit('rpc-key', 'submit')))
    assert.equal(results.filter((r) => r.allowed).length, RATE_LIMIT_MAX_SUBMITS)
    assert.equal(rpcHits, 20)
  })
  setRateLimitSupabaseForTests(null)

  const sql004 = read('supabase/migrations/004_consume_rate_limit.sql')
  assert.match(sql004, /consume_rate_limit/)
  assert.match(sql004, /revoke all on function public\.consume_rate_limit/i)
  assert.match(sql004, /grant execute on function public\.consume_rate_limit[^;]+to service_role/i)
  assert.doesNotMatch(sql004, /^\s*drop\s+table\s+public\.leads/im)
  assert.doesNotMatch(sql004, /^\s*truncate\b/im)

  const sql005 = read('supabase/migrations/005_legal_hold_and_rate_limit_invoker.sql')
  assert.match(sql005, /security invoker/i)
  assert.match(sql005, /search_path\s*=\s*pg_catalog,\s*public,\s*pg_temp/i)
  assert.match(sql005, /revoke all on function public\.consume_rate_limit/i)
  assert.match(sql005, /grant execute on function public\.consume_rate_limit[^;]+to service_role/i)
  assert.match(sql005, /legal_hold/)
  assert.doesNotMatch(sql005, /security definer/i)
  assert.doesNotMatch(sql005, /set search_path\s*=\s*public\s*$/im)
  assert.doesNotMatch(sql005, /^\s*drop\s+table\s+public\.leads/im)
  assert.doesNotMatch(sql005, /^\s*truncate\b/im)
  console.log('P0_RATE_LIMIT_ATOMIC=PASS')
  console.log('RATE_LIMIT_ATOMIC_CODE=PASS')
  console.log('RATE_LIMIT_ATOMIC_REMOTE_DB=UNKNOWN')
  console.log('RPC_PRIVILEGE_HARDENING=PASS')
}

function assertProvenExpertConsent() {
  assert.equal(shouldLoadProvenExpertScript(undefined), false)
  assert.equal(shouldLoadProvenExpertScript(JSON.stringify(essentialOnlyConsent())), false)
  assert.equal(shouldLoadProvenExpertScript(JSON.stringify({ essential: true, analytics: true })), false)
  assert.equal(shouldLoadProvenExpertScript(JSON.stringify(acceptOptionalProvenExpertConsent())), true)

  const widget = read('components/ui/ProSealWidget.js')
  assert.match(widget, /shouldLoadProvenExpertScript/)
  assert.match(widget, /planProvenExpertWithdrawal/)
  assert.match(widget, /stripProvenExpertDom/)
  assert.match(widget, /loadExternal/)
  const banner = read('components/ui/CookieBanner.jsx')
  assert.doesNotMatch(banner, /keine Daten ohne deine Zustimmung/)
  assert.doesNotMatch(banner, /loadExternalScripts/)
  assert.doesNotMatch(banner, /analytics:\s*true/)
  assert.match(banner, /ProvenExpert|acceptOptionalProvenExpertConsent/)
  assert.match(widget, /PROVENEXPERT_SCRIPT_URL/)
  assert.match(read('lib/consent/third-party.js'), new RegExp(PROVENEXPERT_SCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  console.log('P0_PROVENEXPERT_CONSENT=PASS')
}

function makeDeletionClient() {
  const leads = [
    {
      id: 'lead-1',
      email: 'person@example.invalid',
      page_source: 'unternehmen',
      status: 'new',
      firma: 'Acme GmbH',
      payload: {
        email: 'person@example.invalid',
        ansprechpartner: 'Ada',
        phone: '0123',
        nachricht: 'secret',
        firma: 'Acme GmbH',
        standorte: 2,
      },
    },
  ]
  const careers = [
    {
      id: 'car-1',
      email: 'person@example.invalid',
      status: 'new',
      full_name: 'Ada Lovelace',
      payload: { name: 'Ada', motivation: 'please hire', email: 'person@example.invalid' },
    },
  ]
  const audits = []

  function matches(row, filters) {
    return filters.every((f) => {
      if (f.op === 'eq') return row[f.col] === f.val
      if (f.op === 'neq') return row[f.col] !== f.val
      if (f.op === 'in') return f.val.includes(row[f.col])
      if (f.op === 'is') return row[f.col] == null
      return true
    })
  }

  function tableApi(name, rows) {
    const filters = []
    const q = {
      select() { return q },
      eq(col, val) { filters.push({ op: 'eq', col, val }); return q },
      neq(col, val) { filters.push({ op: 'neq', col, val }); return q },
      in(col, val) { filters.push({ op: 'in', col, val }); return q },
      is(col, val) { filters.push({ op: 'is', col, val }); return q },
      lt() { return q },
      update(patch) {
        q._patch = patch
        q._mode = 'update'
        return q
      },
      delete() {
        q._mode = 'delete'
        return q
      },
      insert(row) {
        if (name === 'audit_events') audits.push(row)
        return Promise.resolve({ data: row, error: null })
      },
      then(resolve) {
        const selected = rows.filter((r) => matches(r, filters))
        if (q._mode === 'update') {
          for (const row of selected) Object.assign(row, q._patch)
        }
        if (q._mode === 'delete') {
          for (const row of selected) {
            const idx = rows.indexOf(row)
            if (idx >= 0) rows.splice(idx, 1)
          }
        }
        resolve({ data: selected, error: null })
      },
    }
    return q
  }

  return {
    leads,
    careers,
    audits,
    from(table) {
      if (table === 'leads') return tableApi('leads', leads)
      if (table === 'career_applications') return tableApi('careers', careers)
      if (table === 'audit_events') return tableApi('audit_events', audits)
      throw new Error(table)
    },
  }
}

async function assertDeletionPrivacy() {
  const cleaned = anonymisePayload(
    {
      email: 'a@example.invalid',
      firstName: 'Ada',
      phone: '0999',
      nachricht: 'hi',
      motivation: 'x',
      firma: 'KeepMe',
      type: 'strom',
    },
    { keepFirma: true },
  )
  assert.equal(cleaned.email, undefined)
  assert.equal(cleaned.firstName, undefined)
  assert.equal(cleaned.phone, undefined)
  assert.equal(cleaned.nachricht, undefined)
  assert.equal(cleaned.motivation, undefined)
  assert.equal(cleaned.firma, 'KeepMe')
  assert.equal(cleaned.type, 'strom')

  await withEnv({ AUDIT_EMAIL_HASH_SALT: 'audit-salt-separate' }, async () => {
    const client = makeDeletionClient()
    const result = await processLeadDeletion(client, 'person@example.invalid', { channel: 'all', mode: 'anonymise' })
    assert.equal(result.error, null)
    assert.equal(result.updated, 1)
    assert.equal(result.careerUpdated, 1)
    assert.equal(client.leads[0].email, ANONYMISED_EMAIL)
    assert.equal(client.leads[0].payload.email, undefined)
    assert.equal(client.leads[0].payload.nachricht, undefined)
    assert.equal(client.leads[0].payload.phone, undefined)
    assert.equal(client.leads[0].firma, 'Acme GmbH')
    assert.equal(client.careers[0].email, ANONYMISED_EMAIL)
    assert.equal(client.careers[0].full_name, null)
    assert.equal(client.careers[0].payload.motivation, undefined)
    const audit = client.audits[0]
    const dumped = JSON.stringify(audit)
    assert.doesNotMatch(dumped, /person@example\.invalid/)
    assert.ok(audit.detail.email_hmac)
    assert.equal(
      audit.detail.email_hmac,
      createHmac('sha256', 'audit-salt-separate').update('person@example.invalid').digest('hex'),
    )
    assert.equal(audit.detail.email, undefined)
  })

  const noSalt = emailAuditPseudonym('person@example.invalid')
  assert.equal(noSalt.email_hmac, null)
  assert.equal(noSalt.salt_configured, false)
  console.log('P0_DELETE_ANONYMISE=PASS')
}

function assertAiAndHealthArtifacts() {
  const guard = read('docs/compliance/AI_ACT_GUARDRAILS.md')
  assert.match(guard, /CUSTOMER_FACING_AI=NO/)
  assert.match(guard, /INTERNAL_AI_USE=YES/)
  assert.match(guard, /CURRENT_CUSTOMER_AI=NO/)
  assert.match(guard, /CURRENT_AI_LEAD_SCORING=NO/)
  assert.match(guard, /CURRENT_AUTOMATED_LEGAL_DECISIONS=NO/)
  assert.match(guard, /CAREER_AI_SELECTION_ALLOWED=NO/)
  assert.match(guard, /ARTICLE50_FUTURE_AI_GATE=PASS/)
  assert.match(guard, /Cursor Cloud Agent/)
  const lit = read('docs/compliance/AI_LITERACY_REGISTER.md')
  assert.match(lit, /ARTICLE4_AI_LITERACY_REGISTER=PARTIAL/)
  assert.match(lit, /INTERNAL_AI_USE=YES/)
  assert.match(lit, /TRAINING=UNKNOWN/)
  assert.match(lit, /operators/)
  assert.match(lit, /training/)
  assert.match(lit, /does \*\*not\*\* claim automatic legal compliance/)
  assert.match(lit, /Cursor Cloud Agent/)
  assert.doesNotMatch(lit, /ARTICLE4_AI_LITERACY_REGISTER=TEMPLATE/)

  const careerRoute = read('app/api/careers/route.js')
  assert.doesNotMatch(careerRoute, /openai|anthropic|llm|embeddings|ai.score|rankCandidate/i)
  const careerVal = read('lib/leads/validate-career.js')
  assert.doesNotMatch(careerVal, /score|rank|llm/i)
  const siteFiles = ['app/karriere/page.js', 'components/sections/CareerSection.jsx', 'app/layout.js']
  for (const f of siteFiles) {
    const text = read(f)
    assert.doesNotMatch(text, /Dieser Dienst nutzt KI|AI-generated|Artikel 50/i)
  }

  const leads = publicLeadsHealth()
  const careers = publicCareersHealth()
  const dumped = JSON.stringify({ leads, careers })
  assert.doesNotMatch(dumped, /RESEND|SUPABASE|SECRET|RECAPTCHA_SECRET|SERVICE_ROLE|internal_live|ALLOW_CUSTOMER|mailModeDefault/)
  assert.ok(existsSync(join(root, 'docs/compliance/PROCESSOR_TRANSFER_EVIDENCE.md')))
  assert.ok(existsSync(join(root, 'docs/compliance/RECAPTCHA_DATA_FLOW.md')))
  assert.ok(existsSync(join(root, 'docs/compliance/DELETION_RETENTION_MODES.md')))
  assert.ok(existsSync(join(root, 'public/ops/inbox.js')))
  const csp = read('lib/leads/security-headers.js')
  assert.match(csp, /script-src 'self'/)
  assert.doesNotMatch(csp, /script-src 'unsafe-inline'/)
  console.log('P0_AI_HEALTH_ARTIFACTS=PASS')
}

async function main() {
  await assertServerOwnedActionBinding()
  await assertEnterpriseVsStandard()
  await assertAtomicRateLimit()
  assertProvenExpertConsent()
  await assertDeletionPrivacy()
  assertAiAndHealthArtifacts()
  console.log('P0_REMEDIATION_TESTS=PASS')
  console.log('REAL_CUSTOMER_MAIL_SENT=NO')
  console.log('PRODUCTION_DATA_MUTATED=NO')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
