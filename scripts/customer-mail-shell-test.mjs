#!/usr/bin/env node
/**
 * Customer mail shell is renderable. Unified inquiry still does not send it.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildCustomerMail,
  CUSTOMER_MAIL_VARIANTS,
  customerMailVariantForInquiry,
} from '../lib/leads/customer-mail.js'
import { sendLeadEmails, shouldSendCustomerMail } from '../lib/leads/mail.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function assertShell() {
  const submittedAt = '2026-09-26T08:00:00.000Z'
  for (const variant of CUSTOMER_MAIL_VARIANTS) {
    const mail = buildCustomerMail({
      variant,
      leadRef: 'REF-1',
      name: 'Ada',
      submittedAt,
    })
    assert.equal(mail.customerGate, 'off')
    assert.match(mail.html, /ANFRAGE ERFOLGREICH EINGEGANGEN/)
    assert.match(mail.html, /Was passiert jetzt\?/)
    assert.match(mail.html, /kontakt@deintarifheld\.de/)
    assert.match(mail.html, /\/impressum\//)
    assert.match(mail.html, /\/datenschutz\//)
    assert.match(mail.text, /ANFRAGE ERFOLGREICH EINGEGANGEN/)
    assert.doesNotMatch(mail.subject, /[\r\n]/)
    assert.equal((mail.html.match(/<html/g) || []).length, 1)
  }

  const hostile = buildCustomerMail({
    variant: 'private',
    leadRef: 'REF\r\nBcc: evil@example.invalid',
    name: 'Ada<script>alert(1)</script>',
    submittedAt,
  })
  assert.doesNotMatch(hostile.html, /<script/i)
  assert.match(hostile.html, /&lt;script&gt;/)
  assert.doesNotMatch(hostile.html, /\r|\nBcc/)
  assert.doesNotMatch(hostile.subject, /[\r\n]/)
  assert.doesNotMatch(hostile.text, /\r|\nBcc/)
  assert.equal(hostile.subject, 'Deine Anfrage bei DeinTarifheld')

  const business = buildCustomerMail({ variant: 'business', leadRef: 'B2B-1', name: 'Nord', submittedAt })
  assert.match(business.html, /Guten Tag/)
  assert.match(business.html, /keine automatische Vertragsänderung/)
  assert.match(business.html, /keine Provision/)
  assert.match(business.html, /#F98540/i)
  assert.match(business.html, /#090B15/i)

  const partner = buildCustomerMail({ variant: 'partner', leadRef: 'PAR-1', name: 'Ada', submittedAt })
  assert.match(partner.html, /Zusammenarbeit/)
  assert.match(partner.html, /persönlich/)
  assert.match(partner.html, /#0A5ADB/i)

  const general = buildCustomerMail({ variant: 'general', leadRef: 'GEN-1', name: 'Ada', submittedAt })
  assert.match(general.html, /#090B15/i)
  assert.match(general.html, /#D4FF3E/i)
  const privateMail = buildCustomerMail({ variant: 'private', leadRef: 'PRV-1', name: 'Ada', submittedAt })
  assert.match(privateMail.html, /Hallo Ada/)
  assert.match(privateMail.html, /#D4FF3E/i)

  assert.equal(customerMailVariantForInquiry('private_energy'), 'private')
  assert.equal(customerMailVariantForInquiry('business_energy'), 'business')
  assert.equal(customerMailVariantForInquiry('partner'), 'partner')
  assert.equal(customerMailVariantForInquiry('general'), 'general')
  assert.throws(() => buildCustomerMail({ variant: 'nope', leadRef: 'X', name: 'A', submittedAt }))
  console.log('CUSTOMER_MAIL_SHELL=PASS')
}

async function assertGateStaysOff() {
  const prevMode = process.env.LEADS_MAIL_MODE
  const prevAllow = process.env.ALLOW_CUSTOMER_MAIL
  const prevKey = process.env.RESEND_API_KEY
  const prevFrom = process.env.LEADS_FROM_EMAIL
  const prevTo = process.env.LEADS_TO_EMAIL
  const originalFetch = globalThis.fetch
  const sends = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    if (!url.includes('api.resend.com')) throw new Error(`unexpected_fetch ${url}`)
    sends.push(init.body ? JSON.parse(init.body) : {})
    return new Response(JSON.stringify({ id: 'email_shell_test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  process.env.LEADS_MAIL_MODE = 'live'
  process.env.ALLOW_CUSTOMER_MAIL = 'YES'
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.LEADS_FROM_EMAIL = 'DeinTarifheld <onboarding@resend.dev>'
  process.env.LEADS_TO_EMAIL = 'ops-account@example.invalid'
  try {
    for (const inquiryType of ['private_energy', 'business_energy', 'partner', 'general']) {
      assert.equal(shouldSendCustomerMail({ inquiry_type: inquiryType, email: 'ada@example.invalid' }), false)
      sends.length = 0
      const result = await sendLeadEmails({
        leadRef: 'REF-GATE',
        submittedAt: '2026-09-26T08:00:00.000Z',
        channel: inquiryType === 'partner' ? 'partner' : 'business',
        data: {
          inquiry_type: inquiryType,
          name: 'Ada',
          email: 'ada@example.invalid',
        },
      })
      assert.equal(result.customerConfirmation, 'skipped')
      assert.equal(sends.length, 1)
      assert.deepEqual(sends[0].to, ['ops-account@example.invalid'])
      assert.doesNotMatch(String(sends[0].html || ''), /ANFRAGE ERFOLGREICH EINGEGANGEN/)
    }
  } finally {
    globalThis.fetch = originalFetch
    if (prevMode == null) delete process.env.LEADS_MAIL_MODE
    else process.env.LEADS_MAIL_MODE = prevMode
    if (prevAllow == null) delete process.env.ALLOW_CUSTOMER_MAIL
    else process.env.ALLOW_CUSTOMER_MAIL = prevAllow
    if (prevKey == null) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = prevKey
    if (prevFrom == null) delete process.env.LEADS_FROM_EMAIL
    else process.env.LEADS_FROM_EMAIL = prevFrom
    if (prevTo == null) delete process.env.LEADS_TO_EMAIL
    else process.env.LEADS_TO_EMAIL = prevTo
  }
  const mailSrc = readFileSync(join(root, 'lib/leads/mail.js'), 'utf8')
  assert.match(mailSrc, /if \(usesInquiryMail\(data\)\) return false/)
  assert.doesNotMatch(mailSrc, /buildCustomerMail/)
  const preview = readFileSync(join(root, 'scripts/customer-mail-preview.mjs'), 'utf8')
  assert.doesNotMatch(preview, /sendLeadEmails|resend\.emails/)
  console.log('CUSTOMER_MAIL_GATE=OFF')
}

assertShell()
await assertGateStaysOff()
console.log('CUSTOMER_MAIL_SHELL_TEST=PASS')
