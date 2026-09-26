#!/usr/bin/env node
/**
 * Unified intake contract: types, validation, dispatch, captcha binding,
 * idempotency, mail failure, false-success, and header injection.
 * No network. No secrets.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPTCHA_ACTION_INQUIRY, resolveExpectedCaptchaAction } from '../lib/leads/captcha-action.js'
import {
  INQUIRY_TYPES,
  isDocumentedInquirySuccess,
  inquirySubjectLabel,
} from '../lib/leads/inquiry-contract.js'
import { validateInquiryPayload } from '../lib/leads/validate-inquiry.js'
import { dispatchUnifiedInquiry, inquiryPublicResult } from '../lib/leads/inquiry-dispatch.js'
import {
  buildInquiryOpsMail,
  safeFromAddress,
  safeReplyTo,
  shouldSendCustomerMail,
  stripMailControls,
} from '../lib/leads/mail.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function base(type, extra = {}) {
  return {
    inquiry_type: type,
    page_source: 'inquiry',
    name: 'Ada Muster',
    email: 'ada@example.invalid',
    phone: '0170123456',
    dsgvo: true,
    source_page: '/kontakt/',
    form_version: '3.0',
    ...extra,
  }
}

function assertTypesValidate() {
  const privateLead = validateInquiryPayload(base('private_energy', { plz: '69124', verbrauch: '3500' }))
  assert.equal(privateLead.ok, true)
  assert.equal(privateLead.data.page_source, 'privat')
  assert.equal(privateLead.data._recaptchaToken, undefined)

  const business = validateInquiryPayload(base('business_energy', { plz: '69124', firma: 'Held GmbH', zaehler: 'Z1' }))
  assert.equal(business.ok, true)
  assert.equal(business.data.page_source, 'unternehmen')

  const partner = validateInquiryPayload(base('partner', { motivation: 'Ich moechte selbststaendig beraten.' }))
  assert.equal(partner.ok, true)
  assert.equal(partner.data.page_source, 'career')

  const general = validateInquiryPayload(base('general', { nachricht: 'Bitte um Rueckruf.' }))
  assert.equal(general.ok, true)
  assert.equal(general.data.page_source, 'general')
  console.log('INQUIRY_TYPES_VALIDATE=PASS')
}

function assertRejects() {
  assert.equal(validateInquiryPayload(base('nope', { plz: '69124' })).code, 'unsupported-inquiry-type')
  assert.equal(validateInquiryPayload({ ...base('general', { nachricht: 'Hi' }), page_source: 'hero-funnel' }).code, 'unsupported-page-source')
  assert.equal(validateInquiryPayload({ ...base('general', { nachricht: 'Hi' }), extra: 'x' }).code, 'invalid-payload')
  assert.equal(validateInquiryPayload(base('general', { nachricht: 'Hi', name: 'A\r\nBcc: evil@x' })).code, 'invalid-payload')
  assert.equal(validateInquiryPayload(base('general', { nachricht: 'x'.repeat(2001) })).code, 'invalid-message')
  assert.equal(validateInquiryPayload(base('private_energy', { plz: '12' })).code, 'invalid-plz')
  assert.equal(validateInquiryPayload(base('partner', { motivation: 'kurz' })).code, 'invalid-message')
  assert.equal(validateInquiryPayload({ ...base('general', { nachricht: 'Hi' }), dsgvo: false }).code, 'privacy-required')
  assert.equal(validateInquiryPayload({ ...base('general', { nachricht: 'Hi' }), cv: 'x' }).code, 'invalid-payload')
  const huge = base('general', { nachricht: 'Hi' })
  huge.email = 'a'.repeat(400) + '@example.invalid'
  assert.equal(validateInquiryPayload(huge).code, 'invalid-message')
  console.log('INQUIRY_REJECTS=PASS')
}

function assertCaptchaBinding() {
  const binding = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'inquiry' })
  assert.equal(binding.expectedAction, 'inquiry')
  assert.equal(binding.expectedAction, CAPTCHA_ACTION_INQUIRY)
  assert.equal(resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: 'hero-funnel' }).expectedAction, 'hero_funnel')
  const route = readFileSync(join(root, 'app/api/leads/route.js'), 'utf8')
  const intakeAt = route.indexOf('enforcePublicIntake')
  const dispatchAt = route.indexOf('dispatchUnifiedInquiry')
  assert.ok(intakeAt >= 0 && dispatchAt > intakeAt)
  const guard = readFileSync(join(root, 'lib/leads/intake-guard.js'), 'utf8')
  assert.match(guard, /never used as expectedAction/)
  assert.doesNotMatch(guard, /expectedAction:\s*raw\._recaptchaAction/)
  console.log('INQUIRY_CAPTCHA_BINDING=PASS')
}

function memoryIo() {
  const leads = []
  const careers = []
  const state = { sends: 0, failMail: false, errors: 0 }
  const io = {
    leads,
    careers,
    state,
    consumeRateLimit: async () => {
      state.errors += 1
      return { allowed: true }
    },
    getSupabase: () => ({ connected: true }),
    findLeadReplay: async (_sb, key) => ({ data: leads.find((row) => row.idempotency_key === key) || null, error: null }),
    findRecentLeadReplay: async (_sb, { email, pageSource }) => ({
      duplicate: leads.find((row) => row.email === email && row.page_source === pageSource && row.status !== 'deleted') || null,
      error: null,
    }),
    claimLeadMailRetry: async (_sb, id) => {
      const row = leads.find((item) => item.id === id && item.mail_status === 'failed')
      if (!row) return { claimed: false, error: null }
      row.mail_status = 'retrying'
      return { claimed: true, error: null }
    },
    insertLead: async (_sb, row) => {
      if (leads.some((item) => item.idempotency_key === row.idempotency_key)) {
        return { data: null, error: { code: '23505' } }
      }
      const data = { id: `L${leads.length + 1}`, lead_ref: row.lead_ref }
      leads.push({ ...row, ...data, mail_status: null })
      return { data, error: null }
    },
    updateLeadMailMeta: async (_sb, id, patch) => {
      const row = leads.find((item) => item.id === id)
      row.mail_status = patch.mailStatus
      row.mail_mode = patch.mailMode
      return { error: null }
    },
    findCareerReplay: async (_sb, key) => ({ data: careers.find((row) => row.idempotency_key === key) || null, error: null }),
    findRecentCareerReplay: async (_sb, { email }) => ({
      duplicate: careers.find((row) => row.email === email && row.status !== 'deleted') || null,
      error: null,
    }),
    claimCareerMailRetry: async (_sb, id) => {
      const row = careers.find((item) => item.id === id && item.mail_status === 'failed')
      if (!row) return { claimed: false, error: null }
      row.mail_status = 'retrying'
      return { claimed: true, error: null }
    },
    insertCareer: async (_sb, row) => {
      if (careers.some((item) => item.idempotency_key === row.idempotency_key)) {
        return { data: null, error: { code: '23505' } }
      }
      const data = { id: `C${careers.length + 1}`, application_ref: row.application_ref }
      careers.push({ ...row, ...data, mail_status: null })
      return { data, error: null }
    },
    updateCareerMailMeta: async (_sb, id, patch) => {
      const row = careers.find((item) => item.id === id)
      row.mail_status = patch.mailStatus
      row.mail_mode = patch.mailMode
      return { error: null }
    },
    writeAudit: async () => ({ error: null }),
    sendMail: async () => {
      state.sends += 1
      if (state.failMail) {
        return { ok: false, code: 'mail-send-failed', mode: 'internal_live', mailStatus: 'failed', customerConfirmation: 'skipped' }
      }
      return { ok: true, mode: 'mock', mailStatus: 'accepted', customerConfirmation: 'skipped' }
    },
    makeLeadRef: (src) => `REF-${src}`,
    now: () => '2026-09-26T08:00:00.000Z',
  }
  return io
}

function request(key) {
  return {
    headers: {
      get(name) {
        if (String(name).toLowerCase() === 'idempotency-key') return key
        return null
      },
    },
  }
}

async function assertDispatch() {
  const io = memoryIo()
  const raw = base('private_energy', { plz: '69124' })
  const first = await dispatchUnifiedInquiry({ request: request('idem-private-1'), raw, rlKey: 'k' }, io)
  assert.equal(first.status, 200)
  assert.equal(isDocumentedInquirySuccess(first.status, first.body), true)
  assert.equal(io.leads.length, 1)
  assert.equal(io.state.sends, 1)
  assert.equal(io.leads[0].payload._recaptchaToken, undefined)
  assert.equal(io.leads[0].lead_type, 'private_energy')

  const replay = await dispatchUnifiedInquiry({ request: request('idem-private-1'), raw, rlKey: 'k' }, io)
  assert.equal(replay.body.duplicate, true)
  assert.equal(io.leads.length, 1)
  assert.equal(io.state.sends, 1, 'successful mail must not be sent again')

  io.state.failMail = true
  const business = await dispatchUnifiedInquiry({
    request: request('idem-business-1'),
    raw: base('business_energy', { plz: '10115', firma: 'Nord GmbH', email: 'biz@example.invalid' }),
    rlKey: 'k',
  }, io)
  assert.equal(business.status, 202)
  assert.equal(business.body.ok, false)
  assert.equal(business.body.stored, true)
  assert.equal(business.body.mail, false)
  assert.equal(isDocumentedInquirySuccess(business.status, business.body), false)
  assert.equal(io.leads.length, 2)
  assert.equal(io.leads[1].mail_status, 'failed')

  io.state.failMail = false
  const retried = await dispatchUnifiedInquiry({
    request: request('idem-business-1'),
    raw: base('business_energy', { plz: '10115', firma: 'Nord GmbH', email: 'biz@example.invalid' }),
    rlKey: 'k',
  }, io)
  assert.equal(isDocumentedInquirySuccess(retried.status, retried.body), true)
  assert.equal(io.leads.length, 2, 'mail retry must not create a second lead')

  const partner = await dispatchUnifiedInquiry({
    request: request('idem-partner-1'),
    raw: base('partner', { motivation: 'Zusammenarbeit als Berater interessiert mich.', email: 'partner@example.invalid' }),
    rlKey: 'k',
  }, io)
  assert.equal(partner.status, 200)
  assert.equal(io.careers.length, 1)
  assert.equal(io.leads.length, 2)

  const general = await dispatchUnifiedInquiry({
    request: request('idem-general-1'),
    raw: base('general', { nachricht: 'Allgemeine Frage zum Ablauf.', email: 'general@example.invalid' }),
    rlKey: 'k',
  }, io)
  assert.equal(general.status, 200)
  assert.equal(io.leads.filter((row) => row.lead_type === 'general').length, 1)

  const bad = await dispatchUnifiedInquiry({
    request: request('idem-bad'),
    raw: base('nope'),
    rlKey: 'k',
  }, io)
  assert.equal(bad.status, 400)
  assert.equal(bad.body.stored, false)
  assert.equal(io.state.errors >= 1, true)

  const bot = await dispatchUnifiedInquiry({
    request: request('idem-bot'),
    raw: base('general', { nachricht: 'Hi', website_url: 'http://spam.example' }),
    rlKey: 'k',
  }, io)
  assert.equal(bot.status, 403)
  assert.equal(io.leads.some((row) => row.email === 'ada@example.invalid' && row.lead_type === 'general'), false)

  const failed = inquiryPublicResult({
    mailResult: { ok: false, code: 'mail-send-failed', mailStatus: 'failed', mode: 'internal_live' },
    leadId: '1',
    leadRef: 'REF',
  })
  assert.equal(isDocumentedInquirySuccess(failed.status, failed.body), false)
  console.log('INQUIRY_DISPATCH=PASS')
}

function assertMailSafety() {
  for (const type of INQUIRY_TYPES) {
    const mail = buildInquiryOpsMail({
      leadRef: 'REF-1',
      submittedAt: '2026-09-26T08:00:00.000Z',
      data: {
        inquiry_type: type,
        name: 'Ada\r\nBcc: evil@example.invalid',
        email: 'ada@example.invalid',
        firma: type === 'business_energy' ? 'Held GmbH' : '',
      },
    })
    assert.match(mail.subjectAdmin, new RegExp(inquirySubjectLabel(type).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(mail.subjectAdmin, /[\r\n]/)
    assert.doesNotMatch(mail.adminHtml, /<script/i)
    assert.equal(mail.customerEmail, undefined)
  }
  assert.equal(safeReplyTo('ada@example.invalid\r\nBcc: evil@example.invalid'), '')
  assert.equal(safeReplyTo('ada@example.invalid'), 'ada@example.invalid')
  assert.equal(safeFromAddress('DeinTarifheld <kontakt@deintarifheld.de>'), 'DeinTarifheld <kontakt@deintarifheld.de>')
  assert.equal(safeFromAddress('DeinTarifheld <kontakt@deintarifheld.de>\r\nBcc: evil@example.invalid'), '')
  assert.doesNotMatch(safeFromAddress('bad\r\nfrom@example.invalid'), /[\r\n]/)
  assert.doesNotMatch(stripMailControls('A\r\nB'), /[\r\n]/)

  const prevMode = process.env.LEADS_MAIL_MODE
  const prevAllow = process.env.ALLOW_CUSTOMER_MAIL
  process.env.LEADS_MAIL_MODE = 'live'
  process.env.ALLOW_CUSTOMER_MAIL = 'YES'
  assert.equal(shouldSendCustomerMail({ inquiry_type: 'general', email: 'a@b.co' }), false)
  assert.equal(shouldSendCustomerMail({ email: 'a@b.co' }), true)
  process.env.ALLOW_CUSTOMER_MAIL = 'NO'
  assert.equal(shouldSendCustomerMail({ email: 'a@b.co' }), false)
  if (prevMode == null) delete process.env.LEADS_MAIL_MODE
  else process.env.LEADS_MAIL_MODE = prevMode
  if (prevAllow == null) delete process.env.ALLOW_CUSTOMER_MAIL
  else process.env.ALLOW_CUSTOMER_MAIL = prevAllow

  const form = readFileSync(join(root, 'components/forms/UnifiedInquiryForm.jsx'), 'utf8')
  assert.match(form, /isDocumentedInquirySuccess/)
  assert.doesNotMatch(form, /RECAPTCHA_API_KEY|SUPABASE_SERVICE_ROLE|RESEND_API_KEY|RECAPTCHA_SECRET/)
  console.log('INQUIRY_MAIL_SAFETY=PASS')
}

await assertTypesValidate()
assertRejects()
assertCaptchaBinding()
await assertDispatch()
assertMailSafety()
console.log('LEADS_INQUIRY_INTAKE=PASS')
