#!/usr/bin/env node
/**
 * Offline tests for LEADS_MAIL_MODE contract + cutover mail gate.
 * Network is mocked via global fetch; no real Resend calls.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildInternalOpsMail, parseLeadToAddresses, sendLeadEmails } from '../lib/leads/mail.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sends = []
let failNext = false
let providerIdSeq = 0

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  if (!url.includes('api.resend.com')) {
    throw new Error(`unexpected_fetch ${url}`)
  }
  const body = init.body ? JSON.parse(init.body) : {}
  sends.push({
    url,
    method: init.method || 'GET',
    from: body.from,
    to: body.to,
    subject: body.subject,
    reply_to: body.reply_to || body.replyTo,
  })
  if (failNext) {
    failNext = false
    return new Response(JSON.stringify({ message: 'forced_failure', name: 'application_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
  providerIdSeq += 1
  return new Response(JSON.stringify({ id: `email_test_${providerIdSeq}` }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
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

const businessData = {
  firma: 'DTH Test GmbH',
  ansprechpartner: 'Synth Tester',
  email: 'synth.customer@example.invalid',
  telefon: '+4915111111111',
  plz: '10115',
  energieart: 'Strom',
  verbrauchStrom: '85000',
  verbrauchGas: '12000',
  standorte: '2',
  versorger: 'Stadtwerke Beispiel',
  vertragslaufzeit: '12 Monate',
  nachricht: 'Bitte Stromtarif prüfen',
  source_page: 'unternehmen',
}
const privateHero = {
  firstName: 'PrivHero',
  email: 'synth.private.hero@example.invalid',
  phone: '+4915222222222',
  zip: '80331',
  provider: 'Beispielversorger',
  usage: '3500',
  type: 'Strom',
  page_source: 'hero-funnel',
  source_page: '/',
}
const privateFunnel = {
  firstName: 'PrivFunnel',
  email: 'synth.private.funnel@example.invalid',
  phone: '+4915333333333',
  zip: '20095',
  provider: 'Anderer Versorger',
  usage: '2800',
  type: 'Gas',
  page_source: 'main_funnel',
  source_page: '/',
}
const careerData = {
  name: 'Career Synth',
  email: 'synth.career@example.invalid',
  phone: '+4915444444444',
  motivation: 'A'.repeat(400),
  source_page: 'career',
}

async function assertModeParsing() {
  await withEnv({ LEADS_MAIL_MODE: 'mock' }, async () => {
    const r = await sendLeadEmails({
      leadRef: 'REF-MOCK',
      data: businessData,
      submittedAt: new Date().toISOString(),
      channel: 'business',
    })
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'mock')
    assert.equal(r.mailStatus, 'accepted')
    assert.equal(sends.length, 0)
  })
  await withEnv({ LEADS_MAIL_MODE: 'fail' }, async () => {
    const r = await sendLeadEmails({
      leadRef: 'REF-FAIL',
      data: businessData,
      submittedAt: new Date().toISOString(),
      channel: 'business',
    })
    assert.equal(r.ok, false)
    assert.equal(r.mode, 'fail')
    assert.equal(r.mailStatus, 'failed')
    assert.equal(sends.length, 0)
  })
  await withEnv(
    {
      LEADS_MAIL_MODE: 'weird',
      RESEND_API_KEY: 're_test',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-BAD',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, false)
      assert.equal(r.code, 'mail-mode-unsupported')
      assert.equal(sends.length, 0)
    },
  )
  console.log('MAIL_MODE_PARSING=PASS')
}

async function assertInternalLiveChannel(channel, data, leadRef) {
  sends.length = 0
  await withEnv(
    {
      LEADS_MAIL_MODE: 'internal_live',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef,
        data,
        submittedAt: new Date().toISOString(),
        channel,
      })
      assert.equal(r.ok, true)
      assert.equal(r.mode, 'internal_live')
      assert.equal(r.mailStatus, 'internal_sent')
      assert.equal(r.customerConfirmation, 'skipped')
      assert.ok(r.providerEmailId)
      assert.equal(sends.length, 1, `${channel} must send exactly one mail`)
      assert.deepEqual(sends[0].to, ['ops-account@example.invalid'])
      assert.match(String(sends[0].from), /onboarding@resend\.dev/)
      assert.notEqual(sends[0].to?.[0], data.email)
    },
  )
}

async function assertInternalLiveAllChannels() {
  await assertInternalLiveChannel('business', businessData, 'REF-BIZ')
  console.log('INTERNAL_LIVE_BUSINESS=PASS')
  await assertInternalLiveChannel('private', privateHero, 'REF-HERO')
  console.log('INTERNAL_LIVE_PRIVATE_HERO=PASS')
  await assertInternalLiveChannel('private', privateFunnel, 'REF-FUNNEL')
  console.log('INTERNAL_LIVE_PRIVATE_FUNNEL=PASS')
  await assertInternalLiveChannel('career', careerData, 'REF-CAREER')
  console.log('INTERNAL_LIVE_CAREER=PASS')
  console.log('CUSTOMER_CONFIRMATION_SKIPPED=PASS')
}

async function assertCommaSeparatedRecipients() {
  sends.length = 0
  await withEnv(
    {
      LEADS_MAIL_MODE: 'internal_live',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'office@example.invalid, kontakt@deintarifheld.de',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-MULTI',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, true)
      assert.deepEqual(sends[0].to, ['office@example.invalid', 'kontakt@deintarifheld.de'])
    },
  )
  console.log('COMMA_SEPARATED_RECIPIENTS=PASS')
}

async function assertIdempotentMailContract() {
  // Mail layer itself is not idempotent; route-level idempotency prevents a second send.
  // Prove one call = one provider send; a second call would send again (caller must gate).
  sends.length = 0
  await withEnv(
    {
      LEADS_MAIL_MODE: 'internal_live',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
    },
    async () => {
      await sendLeadEmails({
        leadRef: 'REF-IDEM',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(sends.length, 1)
    },
  )
  const routes = [
    join(root, 'app/api/leads/route.js'),
    join(root, 'app/api/careers/route.js'),
  ]
  const { readFileSync } = await import('node:fs')
  for (const p of routes) {
    const src = readFileSync(p, 'utf8')
    assert.match(src, /findLeadByIdempotencyKey|findCareerByIdempotencyKey|idempotent/)
    assert.match(src, /customer_confirmation_skipped|customerConfirmation/)
  }
  console.log('IDEMPOTENT_MAIL_CONTRACT=PASS')
}

async function assertFailurePath() {
  sends.length = 0
  failNext = true
  await withEnv(
    {
      LEADS_MAIL_MODE: 'internal_live',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-ERR',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, false)
      assert.equal(r.mailStatus, 'failed')
      assert.equal(r.customerConfirmation, 'skipped')
      assert.equal(r.code, 'mail-send-failed')
      assert.equal(sends.length, 1)
    },
  )
  await withEnv(
    {
      LEADS_MAIL_MODE: 'internal_live',
      RESEND_API_KEY: undefined,
      LEADS_FROM_EMAIL: undefined,
      LEADS_TO_EMAIL: undefined,
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-CFG',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, false)
      assert.equal(r.code, 'mail-not-configured')
    },
  )
  console.log('MAIL_FAILURE=PASS')
}

function assertInquiryFieldsInOpsMail() {
  const mail = buildInternalOpsMail({
    channel: 'career',
    leadRef: 'REF-MIN',
    data: careerData,
    submittedAt: new Date().toISOString(),
  })
  assert.match(mail.adminText, /Neue Karriere-Bewerbung/)
  assert.ok(mail.adminText.includes('A'.repeat(400)))
  assert.match(mail.adminText, /Kundenbestätigung: bewusst übersprungen/)
  assert.doesNotMatch(mail.adminText, /honeypot|user-agent|x-forwarded|RESEND_API_KEY/i)
  const biz = buildInternalOpsMail({
    channel: 'business',
    leadRef: 'REF-MIN-B',
    data: { ...businessData, nachricht: 'Bitte Stromtarif prüfen' },
    submittedAt: new Date().toISOString(),
  })
  assert.match(biz.subjectAdmin, /Strom-Anfrage/)
  assert.match(biz.adminText, /Neue Unternehmensanfrage/)
  assert.match(biz.adminText, /Verbrauch Strom: 85000/)
  assert.match(biz.adminText, /Verbrauch Gas: 12000/)
  assert.match(biz.adminText, /Versorger: Stadtwerke Beispiel/)
  assert.match(biz.adminText, /Bitte Stromtarif prüfen/)
  assert.match(biz.adminHtml, /Neue Unternehmensanfrage \(Strom\)/)
  const priv = buildInternalOpsMail({
    channel: 'private',
    leadRef: 'REF-MIN-P',
    data: privateHero,
    submittedAt: new Date().toISOString(),
  })
  assert.match(priv.subjectAdmin, /Strom-Anfrage/)
  assert.match(priv.adminText, /Neue Privat-Tarifanfrage/)
  assert.match(priv.adminText, /Anbieter: Beispielversorger/)
  assert.match(priv.adminText, /Verbrauch: 3500/)
  assert.match(priv.adminText, /Tarifart: Strom/)
  assert.deepEqual(parseLeadToAddresses('office@example.invalid, kontakt@deintarifheld.de'), [
    'office@example.invalid',
    'kontakt@deintarifheld.de',
  ])
  assert.deepEqual(parseLeadToAddresses('  '), [])
  console.log('INQUIRY_FIELDS_IN_OPS_MAIL=PASS')
  console.log('AUDIT_REDACTION_AND_MINIMIZATION=PASS')
}

function assertCutoverGate() {
  const helper = `
set -euo pipefail
source scripts/deploy/checkdomain/common.sh
run() {
  export LEADS_MAIL_MODE="$1"
  export ALLOW_MOCK_MAIL_CUTOVER="\${2:-NO}"
  if dth_cd_mail_gate_status >/tmp/dth-gate-out.txt; then echo PASS; else echo BLOCK; fi
  grep -E 'CUSTOMER_TRAFFIC_MAIL_GATE|INTERNAL_NOTIFICATION|CUSTOMER_CONFIRMATION|TEMPORARY_MODE|FOLLOW_UP_REQUIRED' /tmp/dth-gate-out.txt || true
}
echo '---mock---'
run mock
echo '---fail---'
run fail
echo '---internal_live---'
run internal_live
echo '---live---'
run live
`
  const r = spawnSync('bash', ['-c', helper], { cwd: root, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  const out = r.stdout
  assert.match(out, /---mock---\nBLOCK/)
  assert.match(out, /---fail---\nBLOCK/)
  assert.match(out, /---internal_live---\nPASS/)
  assert.match(out, /INTERNAL_NOTIFICATION=LIVE/)
  assert.match(out, /CUSTOMER_CONFIRMATION=OFF/)
  assert.match(out, /TEMPORARY_MODE=YES/)
  assert.match(out, /FOLLOW_UP_REQUIRED=RESEND_DOMAIN_VERIFICATION/)
  assert.match(out, /---live---\nPASS/)
  assert.match(out, /CUSTOMER_CONFIRMATION=ON/)
  console.log('CUTOVER_MAIL_GATE=PASS')
}

async function assertLiveStillSendsCustomer() {
  sends.length = 0
  await withEnv(
    {
      LEADS_MAIL_MODE: 'live',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-LIVE',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, true)
      assert.equal(r.mode, 'live')
      assert.equal(r.customerConfirmation, 'sent')
      assert.equal(sends.length, 2)
      assert.deepEqual(sends[1].to, [businessData.email])
    },
  )
  console.log('LIVE_MODE_BACK_COMPAT=PASS')
}

async function main() {
  try {
    await assertModeParsing()
    await assertInternalLiveAllChannels()
    await assertCommaSeparatedRecipients()
    await assertIdempotentMailContract()
    await assertFailurePath()
    assertInquiryFieldsInOpsMail()
    assertCutoverGate()
    await assertLiveStillSendsCustomer()
    console.log('INTERNAL_LIVE_TESTS=PASS')
    console.log('CUSTOMER_CONFIRMATION_SEND_COUNT=0')
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
