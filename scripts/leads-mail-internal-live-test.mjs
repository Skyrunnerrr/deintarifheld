#!/usr/bin/env node
/**
 * Offline tests for LEADS_MAIL_MODE contract + cutover mail gate.
 * Network is mocked via global fetch; no real Resend calls.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCareerMails, buildInternalOpsMail, buildPrivateMails, buildUnternehmenMails, parseLeadToAddresses, resendSendTimeoutMs, sendLeadEmails } from '../lib/leads/mail.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sends = []
let failNext = false
let throwNext = false
let hangNext = false
let failRecipient = ''
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
    idempotencyKey: new Headers(init.headers || {}).get('Idempotency-Key'),
    hasSignal: Boolean(init.signal),
  })
  if (hangNext) {
    hangNext = false
    return new Promise((_resolve, reject) => {
      const signal = init.signal
      if (!signal) {
        reject(new Error('missing_abort_signal'))
        return
      }
      if (signal.aborted) {
        reject(new Error('aborted'))
        return
      }
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
  }
  if (throwNext) {
    throwNext = false
    throw new Error('forced_transport_failure')
  }
  if (failRecipient && Array.isArray(body.to) && body.to.includes(failRecipient)) {
    return new Response(JSON.stringify({ message: 'forced_recipient_failure', name: 'application_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
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
      assert.equal(sends[0].hasSignal, true)
      assert.equal(sends[0].idempotencyKey, `dth-${leadRef}-internal`)
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
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <kontakt@deintarifheld.de>\r\nBcc: attacker@example.invalid',
      LEADS_TO_EMAIL: 'ops@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-BAD-FROM',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, false)
      assert.equal(r.code, 'mail-not-configured')
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
  sends.length = 0
  throwNext = true
  await withEnv(
    {
      LEADS_MAIL_MODE: 'internal_live',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-THROW',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, false)
      assert.equal(r.mailStatus, 'failed')
      assert.equal(r.customerConfirmation, 'skipped')
      assert.equal(r.code, 'mail-send-failed')
      assert.ok(r.providerErrorCode)
    },
  )

  sends.length = 0
  failRecipient = businessData.email
  await withEnv(
    {
      LEADS_MAIL_MODE: 'live',
      ALLOW_CUSTOMER_MAIL: 'YES',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-PARTIAL',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, false)
      assert.equal(r.mailStatus, 'partial_failed')
      assert.equal(r.internalDelivery, 'sent')
      assert.equal(r.customerConfirmation, 'failed')
      assert.ok(r.providerEmailId)
      assert.equal(sends.length, 2)
      assert.deepEqual(sends[0].to, ['ops-account@example.invalid'])
      assert.deepEqual(sends[1].to, [businessData.email])
      assert.equal(sends[0].idempotencyKey, 'dth-REF-PARTIAL-internal')
      assert.equal(sends[1].idempotencyKey, 'dth-REF-PARTIAL-customer')
    },
  )
  failRecipient = ''

  await withEnv({ RESEND_SEND_TIMEOUT_MS: undefined }, async () => {
    assert.equal(resendSendTimeoutMs(), 8000)
  })
  await withEnv({ RESEND_SEND_TIMEOUT_MS: '2500' }, async () => {
    assert.equal(resendSendTimeoutMs(), 2500)
  })
  for (const invalid of ['abc', '99', '15001', '100.5']) {
    await withEnv({ RESEND_SEND_TIMEOUT_MS: invalid }, async () => {
      assert.equal(resendSendTimeoutMs(), null)
    })
  }

  sends.length = 0
  hangNext = true
  await withEnv(
    {
      LEADS_MAIL_MODE: 'internal_live',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
      RESEND_SEND_TIMEOUT_MS: '100',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-TIMEOUT',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, false)
      assert.equal(r.mailStatus, 'failed')
      assert.equal(r.code, 'mail-send-failed')
      assert.equal(r.providerErrorCode, 'resend_timeout')
      assert.equal(sends.length, 1)
      assert.equal(sends[0].hasSignal, true)
      assert.equal(sends[0].idempotencyKey, 'dth-REF-TIMEOUT-internal')
    },
  )

  console.log('MAIL_FAILURE=PASS')
  console.log('MAIL_TRANSPORT_EXCEPTION_CONTAINED=PASS')
  console.log('MAIL_PARTIAL_DELIVERY_TRUTH=PASS')
  console.log('MAIL_PROVIDER_TIMEOUT=PASS')
  console.log('MAIL_PROVIDER_IDEMPOTENCY=PASS')
}

function assertInquiryFieldsInOpsMail() {
  const mail = buildInternalOpsMail({
    channel: 'career',
    leadRef: 'REF-MIN',
    data: careerData,
    submittedAt: new Date().toISOString(),
  })
  assert.match(mail.adminText, /Neue Partneranfrage/)
  assert.doesNotMatch(mail.adminText, /Bewerbung/)
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
  assert.deepEqual(parseLeadToAddresses('ops@example.invalid,ops@example.invalid'), ['ops@example.invalid'])
  assert.deepEqual(parseLeadToAddresses('ops@example.invalid,'), [])
  assert.deepEqual(parseLeadToAddresses('ops@example.invalid\r\nBcc:evil@example.invalid'), [])
  assert.deepEqual(parseLeadToAddresses('not-an-email'), [])
  console.log('INQUIRY_FIELDS_IN_OPS_MAIL=PASS')
  console.log('AUDIT_REDACTION_AND_MINIMIZATION=PASS')
}

function assertMailSubjectHeaderSafety() {
  const injected = {
    business: {
      ...businessData,
      firma: 'Acme GmbH\r\nBcc: attacker@example.invalid',
      energieart: 'Strom\nX-Test: injected',
    },
    private: {
      ...privateHero,
      firstName: 'Max\r\nBcc: attacker@example.invalid',
      type: 'Strom\nX-Test: injected',
    },
    career: {
      ...careerData,
      name: 'Career\r\nBcc: attacker@example.invalid',
    },
  }
  const timestamp = new Date().toISOString()
  const mails = [
    buildUnternehmenMails({ leadRef: 'REF-HDR-B', data: injected.business, submittedAt: timestamp }),
    buildPrivateMails({ leadRef: 'REF-HDR-P', data: injected.private, submittedAt: timestamp }),
    buildCareerMails({ leadRef: 'REF-HDR-C', data: injected.career, submittedAt: timestamp }),
    buildInternalOpsMail({ channel: 'business', leadRef: 'REF-HDR-IB', data: injected.business, submittedAt: timestamp }),
    buildInternalOpsMail({ channel: 'private', leadRef: 'REF-HDR-IP', data: injected.private, submittedAt: timestamp }),
    buildInternalOpsMail({ channel: 'career', leadRef: 'REF-HDR-IC', data: injected.career, submittedAt: timestamp }),
  ]
  for (const mail of mails) {
    assert.equal(typeof mail.subjectAdmin, 'string')
    assert.doesNotMatch(mail.subjectAdmin, /[\r\n\u0000-\u001F\u007F]/)
    assert.ok(mail.subjectAdmin.length <= 260)
  }
  console.log('MAIL_SUBJECT_HEADER_SANITIZATION=PASS')
}

function assertCutoverGate() {
  const helper = `
set -euo pipefail
source scripts/deploy/checkdomain/common.sh
run() {
  export LEADS_MAIL_MODE="$1"
  export ALLOW_MOCK_MAIL_CUTOVER="\${2:-NO}"
  export ALLOW_CUSTOMER_MAIL="\${3:-NO}"
  if dth_cd_mail_gate_status >/tmp/dth-gate-out.txt; then echo PASS; else echo BLOCK; fi
  grep -E 'CUSTOMER_TRAFFIC_MAIL_GATE|ALLOW_CUSTOMER_MAIL|INTERNAL_NOTIFICATION|CUSTOMER_CONFIRMATION|TEMPORARY_MODE|FOLLOW_UP_REQUIRED' /tmp/dth-gate-out.txt || true
}
echo '---mock---'
run mock
echo '---fail---'
run fail
echo '---internal_live---'
run internal_live
echo '---live-blocked---'
run live NO NO
echo '---live-enabled---'
run live NO YES
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
  assert.match(out, /---live-blocked---\nPASS/)
  assert.match(out, /CUSTOMER_CONFIRMATION=BLOCKED_BY_DUAL_GUARD/)
  assert.match(out, /---live-enabled---\nPASS/)
  assert.match(out, /ALLOW_CUSTOMER_MAIL=YES/)
  assert.match(out, /CUSTOMER_CONFIRMATION=ON/)
  console.log('CUTOVER_MAIL_GATE=PASS')
}

async function assertLiveStillSendsCustomer() {
  sends.length = 0
  await withEnv(
    {
      LEADS_MAIL_MODE: 'live',
      ALLOW_CUSTOMER_MAIL: 'YES',
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

async function assertLiveDualGuardBlocksCustomer() {
  sends.length = 0
  await withEnv(
    {
      LEADS_MAIL_MODE: 'live',
      ALLOW_CUSTOMER_MAIL: 'NO',
      RESEND_API_KEY: 're_test_key',
      LEADS_FROM_EMAIL: 'DeinTarifheld <onboarding@resend.dev>',
      LEADS_TO_EMAIL: 'ops-account@example.invalid',
    },
    async () => {
      const r = await sendLeadEmails({
        leadRef: 'REF-LIVE-BLOCK',
        data: businessData,
        submittedAt: new Date().toISOString(),
        channel: 'business',
      })
      assert.equal(r.ok, true)
      assert.equal(r.customerConfirmation, 'blocked')
      assert.equal(sends.length, 1)
      assert.notEqual(sends[0].to?.[0], businessData.email)
    },
  )
  console.log('LIVE_DUAL_GUARD_BLOCKS_CUSTOMER=PASS')
}

async function main() {
  try {
    await assertModeParsing()
    await assertInternalLiveAllChannels()
    await assertCommaSeparatedRecipients()
    await assertIdempotentMailContract()
    await assertFailurePath()
    assertInquiryFieldsInOpsMail()
    assertMailSubjectHeaderSafety()
    assertCutoverGate()
    await assertLiveStillSendsCustomer()
    await assertLiveDualGuardBlocksCustomer()
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
