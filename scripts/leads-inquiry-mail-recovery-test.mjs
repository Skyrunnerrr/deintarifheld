#!/usr/bin/env node
/**
 * Automatic one-shot inquiry mail recovery.
 * No network. No secrets. No second lead row.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dispatchUnifiedInquiry } from '../lib/leads/inquiry-dispatch.js'
import {
  INQUIRY_MAIL_RETRY_MIN_AGE_MS,
  isAutomaticRetryCandidate,
  recoverFailedInquiryMail,
  safeMailErrorCode,
} from '../lib/leads/inquiry-mail-recovery.js'
import { isCronAuthorized } from '../lib/leads/cron-auth.js'
import { shouldSendCustomerMail } from '../lib/leads/mail.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FAILED_AT = '2026-09-26T08:00:00.000Z'
const RECOVERY_AT = '2026-09-26T08:03:00.000Z'
const CRON_SECRET = 'cron-recovery-test-secret-32b-ok'
const ADMIN_SECRET = 'admin-must-not-open-cron-32b-xx'

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

function memoryDispatch({ failMail = false } = {}) {
  const leads = []
  const careers = []
  const state = { sends: 0 }
  const io = {
    leads,
    careers,
    state,
    consumeRateLimit: async () => ({ allowed: true }),
    getSupabase: () => ({ connected: true }),
    findLeadReplay: async (_sb, key) => ({ data: leads.find((row) => row.idempotency_key === key) || null, error: null }),
    findRecentLeadReplay: async () => ({ duplicate: null, error: null }),
    insertLead: async (_sb, row) => {
      const data = { id: `L${leads.length + 1}`, lead_ref: row.lead_ref }
      leads.push({ ...row, ...data, status: row.status || 'new', mail_status: null, updated_at: FAILED_AT })
      return { data, error: null }
    },
    updateLeadMailMeta: async (_sb, id, patch) => {
      const row = leads.find((item) => item.id === id)
      row.mail_status = patch.mailStatus
      row.mail_mode = patch.mailMode
      row.updated_at = FAILED_AT
      return { error: null }
    },
    findCareerReplay: async (_sb, key) => ({ data: careers.find((row) => row.idempotency_key === key) || null, error: null }),
    findRecentCareerReplay: async () => ({ duplicate: null, error: null }),
    insertCareer: async (_sb, row) => {
      const data = { id: `C${careers.length + 1}`, application_ref: row.application_ref }
      careers.push({ ...row, ...data, status: row.status || 'new', mail_status: null, updated_at: FAILED_AT })
      return { data, error: null }
    },
    updateCareerMailMeta: async (_sb, id, patch) => {
      const row = careers.find((item) => item.id === id)
      row.mail_status = patch.mailStatus
      row.mail_mode = patch.mailMode
      row.updated_at = FAILED_AT
      return { error: null }
    },
    writeAudit: async () => ({ error: null }),
    sendMail: async () => {
      state.sends += 1
      if (failMail) {
        return { ok: false, code: 'mail-send-failed', mode: 'internal_live', mailStatus: 'failed', customerConfirmation: 'skipped' }
      }
      return { ok: true, mode: 'mock', mailStatus: 'accepted', customerConfirmation: 'skipped' }
    },
    makeLeadRef: (src) => `REF-${src}`,
    now: () => FAILED_AT,
  }
  return io
}

function recoveryIo({ leads, careers, now = RECOVERY_AT, sendMail, listLeads, listCareers }) {
  const sends = { n: 0 }
  return {
    sends,
    getSupabase: () => ({ connected: true }),
    now: () => now,
    minAgeMs: INQUIRY_MAIL_RETRY_MIN_AGE_MS,
    listFailedLeads: listLeads || (async () => ({
      data: leads.filter((row) => row.mail_status === 'failed' && row.status !== 'deleted'),
      error: null,
    })),
    listFailedCareers: listCareers || (async () => ({
      data: careers.filter((row) => row.mail_status === 'failed' && row.status !== 'deleted'),
      error: null,
    })),
    claimLead: async (_sb, id) => {
      const row = leads.find((item) => item.id === id && item.mail_status === 'failed')
      if (!row) return { claimed: false, error: null }
      row.mail_status = 'retrying'
      return { claimed: true, error: null }
    },
    claimCareer: async (_sb, id) => {
      const row = careers.find((item) => item.id === id && item.mail_status === 'failed')
      if (!row) return { claimed: false, error: null }
      row.mail_status = 'retrying'
      return { claimed: true, error: null }
    },
    updateLead: async (_sb, id, patch) => {
      const row = leads.find((item) => item.id === id)
      row.mail_status = patch.mailStatus
      row.updated_at = now
      return { error: null }
    },
    updateCareer: async (_sb, id, patch) => {
      const row = careers.find((item) => item.id === id)
      row.mail_status = patch.mailStatus
      row.updated_at = now
      return { error: null }
    },
    sendMail: async (args) => {
      sends.n += 1
      return sendMail(args)
    },
  }
}

async function assertInitialAndRetry() {
  const okIo = memoryDispatch()
  const ok = await dispatchUnifiedInquiry({
    request: request('idem-ok'),
    raw: base('private_energy', { plz: '69124' }),
    rlKey: 'k',
  }, okIo)
  assert.equal(ok.status, 200)
  assert.equal(ok.body.mailStatus, 'internal_sent')
  assert.equal(okIo.leads[0].mail_status, 'internal_sent')
  const noRetry = recoveryIo({
    leads: okIo.leads,
    careers: [],
    sendMail: async () => {
      throw new Error('successful lead must not be retried')
    },
  })
  const skipped = await recoverFailedInquiryMail(noRetry)
  assert.equal(skipped.sent, 0)
  assert.equal(noRetry.sends.n, 0)
  assert.equal(okIo.leads.length, 1)
  console.log('INITIAL_MAIL_SUCCESS_NO_RETRY=PASS')

  const failIo = memoryDispatch({ failMail: true })
  const failed = await dispatchUnifiedInquiry({
    request: request('idem-fail'),
    raw: base('business_energy', { plz: '10115', firma: 'Nord GmbH', email: 'biz@example.invalid' }),
    rlKey: 'k',
  }, failIo)
  assert.equal(failed.status, 202)
  assert.equal(failed.body.stored, true)
  assert.equal(failed.body.mail, false)
  assert.equal(failIo.leads.length, 1)
  assert.equal(failIo.leads[0].mail_status, 'failed')
  console.log('INITIAL_MAIL_FAIL_STORED=PASS')

  const retryOk = recoveryIo({
    leads: failIo.leads,
    careers: [],
    sendMail: async () => ({ ok: true, mode: 'internal_live', mailStatus: 'internal_sent', customerConfirmation: 'skipped' }),
  })
  const recovered = await recoverFailedInquiryMail(retryOk)
  assert.equal(recovered.claimed, 1)
  assert.equal(recovered.sent, 1)
  assert.equal(retryOk.sends.n, 1)
  assert.equal(failIo.leads[0].mail_status, 'internal_sent')
  assert.equal(failIo.leads.length, 1)
  console.log('AUTOMATIC_RETRY_SUCCESS=PASS')

  const finalIo = memoryDispatch({ failMail: true })
  await dispatchUnifiedInquiry({
    request: request('idem-final'),
    raw: base('general', { nachricht: 'Frage zum Ablauf.', email: 'general@example.invalid' }),
    rlKey: 'k',
  }, finalIo)
  assert.equal(finalIo.leads[0].mail_status, 'failed')
  const logs = []
  const orig = console.error
  console.error = (line) => logs.push(String(line))
  let retryResult
  try {
    const retryFail = recoveryIo({
      leads: finalIo.leads,
      careers: [],
      sendMail: async () => ({
        ok: false,
        code: 'provider raw-detail not-allowlisted',
        mode: 'internal_live',
        mailStatus: 'failed',
      }),
    })
    retryResult = await recoverFailedInquiryMail(retryFail)
    assert.equal(retryResult.failedFinal, 1)
    assert.equal(retryFail.sends.n, 1)
    assert.equal(finalIo.leads[0].mail_status, 'failed_final')
    const again = recoveryIo({
      leads: finalIo.leads,
      careers: [],
      sendMail: async () => {
        throw new Error('failed_final must not send again')
      },
    })
    const second = await recoverFailedInquiryMail(again)
    assert.equal(second.sent, 0)
    assert.equal(second.failedFinal, 0)
    assert.equal(again.sends.n, 0)
    assert.equal(finalIo.leads[0].mail_status, 'failed_final')
    assert.equal(finalIo.leads.length, 1)
  } finally {
    console.error = orig
  }
  const finalLine = logs.find((line) => line.includes('inquiry.mail_failed_final'))
  assert.ok(finalLine)
  const parsed = JSON.parse(finalLine)
  assert.equal(parsed.event, 'inquiry.mail_failed_final')
  assert.equal(parsed.leadRef, finalIo.leads[0].lead_ref)
  assert.equal(parsed.inquiryType, 'general')
  assert.equal(parsed.storage, 'leads')
  assert.equal(parsed.code, 'mail-send-failed')
  assert.deepEqual(
    Object.keys(parsed).sort(),
    ['code', 'event', 'inquiryType', 'leadRef', 'storage', 'ts'],
  )
  assert.doesNotMatch(finalLine, /raw-detail|not-allowlisted|captcha|api_key/i)
  assert.equal(safeMailErrorCode('provider raw-detail not-allowlisted'), 'mail-send-failed')
  assert.equal(safeMailErrorCode('mail-not-configured'), 'mail-not-configured')
  assert.equal(safeMailErrorCode('ada@example.invalid'), 'mail-send-failed')
  console.log('AUTOMATIC_RETRY_FAILED_FINAL=PASS')
  console.log('SECOND_RUN_UNTOUCHED=PASS')
  console.log('FAILED_FINAL_LOG_EVENT=PASS')
}

async function assertConcurrent() {
  const row = {
    id: 'L-race',
    lead_ref: 'REF-race',
    status: 'new',
    mail_status: 'failed',
    updated_at: FAILED_AT,
    payload: { inquiry_type: 'private_energy', email: 'race@example.invalid', name: 'Ada' },
  }
  const leads = [row]
  let sends = 0
  const io = recoveryIo({
    leads,
    careers: [],
    listLeads: async () => ({ data: [row], error: null }),
    sendMail: async () => {
      sends += 1
      await new Promise((resolve) => setTimeout(resolve, 25))
      return { ok: true, mode: 'internal_live', mailStatus: 'internal_sent', customerConfirmation: 'skipped' }
    },
  })
  const [first, second] = await Promise.all([
    recoverFailedInquiryMail(io),
    recoverFailedInquiryMail(io),
  ])
  assert.equal(sends, 1)
  assert.equal(first.sent + second.sent, 1)
  assert.equal(first.claimed + second.claimed, 1)
  assert.equal(row.mail_status, 'internal_sent')
  console.log('CONCURRENT_RETRY_TEST=PASS')
}

async function assertCustomerMailStillOff() {
  const prevMode = process.env.LEADS_MAIL_MODE
  const prevAllow = process.env.ALLOW_CUSTOMER_MAIL
  process.env.LEADS_MAIL_MODE = 'live'
  process.env.ALLOW_CUSTOMER_MAIL = 'YES'
  const row = {
    id: 'L-cust',
    lead_ref: 'REF-cust',
    status: 'new',
    mail_status: 'failed',
    updated_at: FAILED_AT,
    payload: {
      inquiry_type: 'private_energy',
      email: 'ada@example.invalid',
      name: 'Ada Muster',
    },
  }
  let seen = null
  try {
    const io = recoveryIo({
      leads: [row],
      careers: [],
      sendMail: async (args) => {
        seen = args
        assert.equal(shouldSendCustomerMail(args.data), false)
        return { ok: true, mode: 'live', mailStatus: 'internal_sent', customerConfirmation: 'skipped' }
      },
    })
    await recoverFailedInquiryMail(io)
  } finally {
    if (prevMode == null) delete process.env.LEADS_MAIL_MODE
    else process.env.LEADS_MAIL_MODE = prevMode
    if (prevAllow == null) delete process.env.ALLOW_CUSTOMER_MAIL
    else process.env.ALLOW_CUSTOMER_MAIL = prevAllow
  }
  assert.equal(seen.data.inquiry_type, 'private_energy')
  assert.equal(seen.data.email, 'ada@example.invalid')
  const recoverySrc = readFileSync(join(root, 'lib/leads/inquiry-mail-recovery.js'), 'utf8')
  assert.match(recoverySrc, /sendLeadEmails/)
  assert.doesNotMatch(recoverySrc, /customerEmail|RESEND_API_KEY|CRON_SECRET/)
  console.log('CUSTOMER_MAIL_RETRY=PASS')
}

async function assertIgnoredRows() {
  const deleted = {
    id: 'L-del',
    lead_ref: 'REF-del',
    status: 'deleted',
    mail_status: 'failed',
    updated_at: FAILED_AT,
    payload: { inquiry_type: 'general', email: 'gone@example.invalid' },
  }
  const historical = {
    id: 'L-old',
    lead_ref: 'REF-old',
    status: 'new',
    mail_status: 'internal_sent',
    updated_at: FAILED_AT,
    payload: { inquiry_type: 'private_energy', email: 'old@example.invalid' },
  }
  const fresh = {
    id: 'L-fresh',
    lead_ref: 'REF-fresh',
    status: 'new',
    mail_status: 'failed',
    updated_at: RECOVERY_AT,
    payload: { inquiry_type: 'business_energy', email: 'fresh@example.invalid' },
  }
  const legacy = {
    id: 'L-legacy',
    lead_ref: 'REF-legacy',
    status: 'new',
    mail_status: 'failed',
    updated_at: FAILED_AT,
    payload: { email: 'legacy@example.invalid' },
  }
  assert.equal(isAutomaticRetryCandidate(deleted, Date.parse(RECOVERY_AT)), false)
  assert.equal(isAutomaticRetryCandidate(historical, Date.parse(RECOVERY_AT)), false)
  assert.equal(isAutomaticRetryCandidate(fresh, Date.parse(RECOVERY_AT)), false)
  assert.equal(isAutomaticRetryCandidate(legacy, Date.parse(RECOVERY_AT)), false)
  const io = recoveryIo({
    leads: [deleted, historical, fresh, legacy],
    careers: [],
    listLeads: async () => ({ data: [deleted, historical, fresh, legacy], error: null }),
    sendMail: async () => {
      throw new Error('ignored rows must not send')
    },
  })
  const result = await recoverFailedInquiryMail(io)
  assert.equal(result.sent, 0)
  assert.equal(result.claimed, 0)
  assert.equal(io.sends.n, 0)
  assert.equal(deleted.mail_status, 'failed')
  assert.equal(historical.mail_status, 'internal_sent')
  console.log('DELETED_AND_HISTORICAL_IGNORED=PASS')
}

async function assertPartnerRecovery() {
  const io = memoryDispatch({ failMail: true })
  const partner = await dispatchUnifiedInquiry({
    request: request('idem-partner'),
    raw: base('partner', { motivation: 'Zusammenarbeit als Berater interessiert mich.', email: 'partner@example.invalid' }),
    rlKey: 'k',
  }, io)
  assert.equal(partner.body.stored, true)
  assert.equal(io.careers.length, 1)
  assert.equal(io.leads.length, 0)
  assert.equal(io.careers[0].mail_status, 'failed')
  const retry = recoveryIo({
    leads: io.leads,
    careers: io.careers,
    sendMail: async (args) => {
      assert.equal(args.data.inquiry_type, 'partner')
      assert.equal(args.channel, 'partner')
      return { ok: true, mode: 'internal_live', mailStatus: 'internal_sent', customerConfirmation: 'skipped' }
    },
  })
  const result = await recoverFailedInquiryMail(retry)
  assert.equal(result.sent, 1)
  assert.equal(io.careers[0].mail_status, 'internal_sent')
  assert.equal(io.careers.length, 1)
  assert.equal(io.leads.length, 0)
  console.log('PARTNER_CAREER_RECOVERY=PASS')
}

function assertCronAuth() {
  const prevCron = process.env.CRON_SECRET
  const prevAdmin = process.env.LEADS_ADMIN_SECRET
  process.env.CRON_SECRET = CRON_SECRET
  process.env.LEADS_ADMIN_SECRET = ADMIN_SECRET
  function fakeRequest(headers = {}) {
    return {
      url: `https://leads.example.test/api/cron/inquiry-mail?secret=${CRON_SECRET}&cron_secret=${CRON_SECRET}`,
      nextUrl: { searchParams: new URLSearchParams({ secret: CRON_SECRET, cron_secret: CRON_SECRET }) },
      headers: {
        get(name) {
          return headers[String(name).toLowerCase()] || null
        },
      },
    }
  }
  try {
    assert.equal(isCronAuthorized(fakeRequest()), false)
    assert.equal(isCronAuthorized(fakeRequest({ authorization: `Bearer ${ADMIN_SECRET}` })), false)
    assert.equal(isCronAuthorized(fakeRequest({ 'x-admin-secret': ADMIN_SECRET })), false)
    assert.equal(isCronAuthorized(fakeRequest({ authorization: `Bearer ${CRON_SECRET}` })), true)
    assert.equal(isCronAuthorized(fakeRequest({ 'x-cron-secret': CRON_SECRET })), true)
    delete process.env.CRON_SECRET
    assert.equal(isCronAuthorized(fakeRequest({ authorization: `Bearer ${CRON_SECRET}` })), false)
  } finally {
    if (prevCron == null) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prevCron
    if (prevAdmin == null) delete process.env.LEADS_ADMIN_SECRET
    else process.env.LEADS_ADMIN_SECRET = prevAdmin
  }

  const route = readFileSync(join(root, 'app/api/cron/inquiry-mail/route.js'), 'utf8')
  const authAt = route.indexOf('isCronAuthorized')
  const workAt = route.indexOf('recoverFailedInquiryMail')
  assert.ok(authAt > 0 && workAt > authAt)
  assert.match(route, /export async function POST/)
  assert.match(route, /405/)
  assert.doesNotMatch(route, /searchParams|request\.url|LEADS_ADMIN_SECRET|process\.env\.CRON_SECRET/)
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
  assert.equal(vercel.crons[0].path, '/api/cron/retention')
  assert.equal(vercel.crons[0].schedule, '0 3 * * *')
  assert.equal(vercel.crons[1].path, '/api/cron/inquiry-mail')
  assert.equal(vercel.crons[1].schedule, '15 4 * * *')
  const inbox = readFileSync(join(root, 'public/ops/inbox.js'), 'utf8')
  assert.match(inbox, /internal_sent/)
  assert.match(inbox, /failed_final/)
  assert.match(inbox, /retrying/)
  assert.match(inbox, /badge-failed/)
  console.log('CRON_AUTH=PASS')
  console.log('PUBLIC_RETRY_TRIGGER=CLOSED')
}

await assertInitialAndRetry()
await assertConcurrent()
await assertCustomerMailStillOff()
await assertIgnoredRows()
await assertPartnerRecovery()
assertCronAuth()
console.log('LEADS_INQUIRY_MAIL_RECOVERY=PASS')
