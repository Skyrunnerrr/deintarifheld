import { createHash } from 'crypto'
import { consumeRateLimit } from './abuse-guard.js'
import { leadsLog } from './log.js'
import { sendLeadEmails } from './mail.js'
import {
  inquiryStorageKind,
  isDocumentedInquirySuccess,
  leadRefPrefix,
  mailStatusSucceeded,
} from './inquiry-contract.js'
import { validateInquiryPayload } from './validate-inquiry.js'
import {
  findCareerReplay,
  findLeadReplay,
  findRecentCareerReplay,
  findRecentLeadReplay,
  getServiceSupabase,
  insertCareerApplication,
  insertLead,
  makeLeadRef,
  updateCareerMailMeta,
  updateLeadMailMeta,
  writeAudit,
} from './supabase.js'

export { isDocumentedInquirySuccess }

function buildIdempotencyKey(request, data) {
  const header = request.headers.get('idempotency-key')?.trim()
  if (header && header.length >= 8 && header.length <= 128 && !/[\r\n]/.test(header)) return header
  const window = Math.floor(Date.now() / 60_000)
  return createHash('sha256')
    .update(`inquiry|${data.inquiry_type}|${data.email}|${window}`)
    .digest('hex')
    .slice(0, 48)
}

export function inquiryPublicResult({ mailResult, leadId, leadRef, duplicate = false, idempotent = false }) {
  const mailed =
    mailResult?.ok === true && mailStatusSucceeded(mailResult.mailStatus)
  const body = {
    ok: mailed,
    stored: true,
    leadId,
    leadRef,
    duplicate,
    idempotent,
    mail: mailed,
    mailMode: mailResult?.mode || null,
    mailStatus: mailResult?.mailStatus || 'failed',
    customerConfirmation: 'skipped',
  }
  if (!mailed) body.code = mailResult?.code || 'mail-send-failed'
  return { status: mailed ? 200 : 202, body }
}

function storedMailResult(row) {
  return {
    ok: mailStatusSucceeded(row?.mail_status),
    mode: row?.mail_mode || null,
    mailStatus: row?.mail_status || 'unknown',
    customerConfirmation: 'skipped',
    code: mailStatusSucceeded(row?.mail_status) ? undefined : 'mail-status-unknown',
  }
}

function persistable(data) {
  return {
    inquiry_type: data.inquiry_type,
    name: data.name,
    email: data.email,
    phone: data.phone,
    plz: data.plz,
    verbrauch: data.verbrauch,
    tarifinfo: data.tarifinfo,
    firma: data.firma,
    zaehler: data.zaehler,
    beschreibung: data.beschreibung,
    motivation: data.motivation,
    nachricht: data.nachricht,
    source_page: data.source_page,
    dsgvo: true,
    form_version: data.form_version,
    _formLoadedAt: data._formLoadedAt,
    page_source: data.page_source,
  }
}

function defaultIo() {
  return {
    consumeRateLimit,
    getSupabase: getServiceSupabase,
    findLeadReplay,
    findRecentLeadReplay,
    insertLead,
    updateLeadMailMeta,
    findCareerReplay,
    findRecentCareerReplay,
    insertCareer: insertCareerApplication,
    updateCareerMailMeta,
    writeAudit,
    sendMail: sendLeadEmails,
    makeLeadRef,
    now: () => new Date().toISOString(),
  }
}

async function deliverMail(io, { supabase, kind, id, leadRef, data, submittedAt }) {
  const mailResult = await io.sendMail({
    leadRef,
    data,
    submittedAt,
    channel: data.inquiry_type === 'partner' ? 'partner' : data.inquiry_type === 'private_energy' ? 'private' : 'business',
  })
  const storedStatus = mailResult.ok ? 'internal_sent' : 'failed'
  const patch = {
    mailStatus: storedStatus,
    mailMode: mailResult.mode || process.env.LEADS_MAIL_MODE || 'mock',
  }
  if (kind === 'career') await io.updateCareerMailMeta(supabase, id, patch)
  else await io.updateLeadMailMeta(supabase, id, patch)
  const event = mailResult.ok
    ? kind === 'career'
      ? 'inquiry.partner_mail_sent'
      : 'inquiry.internal_mail_sent'
    : kind === 'career'
      ? 'inquiry.partner_mail_failed'
      : 'inquiry.internal_mail_failed'
  await io.writeAudit(supabase, {
    leadId: kind === 'leads' ? id : null,
    careerId: kind === 'career' ? id : null,
    eventType: event,
    detail: {
      lead_ref: leadRef,
      inquiry_type: data.inquiry_type,
      mail_status: patch.mailStatus,
      code: mailResult.ok ? null : mailResult.code || 'mail-send-failed',
    },
  })
  if (!mailResult.ok) {
    leadsLog('error', 'inquiry.mail_failed', {
      leadRef,
      inquiryType: data.inquiry_type,
      code: mailResult.code || 'mail-send-failed',
    })
  }
  return {
    ...mailResult,
    ok: mailResult.ok === true,
    mailStatus: storedStatus,
    customerConfirmation: 'skipped',
  }
}

async function finishExisting(_io, _supabase, row, { duplicate, idempotent }) {
  const leadRef = row.lead_ref || row.application_ref
  const id = row.id
  if (mailStatusSucceeded(row.mail_status)) {
    return inquiryPublicResult({
      mailResult: storedMailResult(row),
      leadId: id,
      leadRef,
      duplicate,
      idempotent,
    })
  }
  const pending = row.mail_status === 'failed' || row.mail_status === 'retrying'
  return {
    status: 202,
    body: {
      ok: false,
      stored: true,
      mail: false,
      leadId: id,
      leadRef,
      duplicate,
      idempotent,
      mailStatus: row.mail_status || 'unknown',
      customerConfirmation: 'skipped',
      code: pending ? 'mail-pending-recovery' : row.mail_status === 'failed_final' ? 'mail-failed-final' : 'mail-status-unknown',
    },
  }
}

async function dispatchLead(io, supabase, data, idempotencyKey) {
  const { data: existing, error: keyErr } = await io.findLeadReplay(supabase, idempotencyKey)
  if (keyErr) return { status: 500, body: { ok: false, stored: false, mail: false, code: 'storage-failed' } }
  if (existing) return finishExisting(io, supabase, existing, { kind: 'leads', duplicate: true, idempotent: true })

  const { duplicate, error: dupErr } = await io.findRecentLeadReplay(supabase, {
    email: data.email,
    pageSource: data.page_source,
    withinSeconds: 60,
  })
  if (dupErr) return { status: 500, body: { ok: false, stored: false, mail: false, code: 'storage-failed' } }
  if (duplicate) return finishExisting(io, supabase, duplicate, { kind: 'leads', duplicate: true, idempotent: false })

  const leadRef = io.makeLeadRef(leadRefPrefix(data.inquiry_type))
  const submittedAt = io.now()
  const payload = { ...persistable(data), received_at: submittedAt }
  const { data: inserted, error: insertError } = await io.insertLead(supabase, {
    lead_ref: leadRef,
    page_source: data.page_source,
    lead_type: data.inquiry_type,
    status: 'new',
    email: data.email,
    firma: data.firma || null,
    consent_at: submittedAt,
    source_page: data.source_page,
    idempotency_key: idempotencyKey,
    payload,
  })
  if (insertError) {
    if (insertError.code === '23505') {
      const raced = await io.findLeadReplay(supabase, idempotencyKey)
      if (raced.data) {
        return finishExisting(io, supabase, raced.data, { kind: 'leads', duplicate: true, idempotent: true })
      }
    }
    leadsLog('error', 'inquiry.insert_failed', { inquiryType: data.inquiry_type, code: insertError.code || 'unknown' })
    return { status: 500, body: { ok: false, stored: false, mail: false, code: 'storage-failed' } }
  }

  await io.writeAudit(supabase, {
    leadId: inserted.id,
    eventType: 'inquiry.accepted',
    detail: { lead_ref: leadRef, inquiry_type: data.inquiry_type },
  })

  const mailResult = await deliverMail(io, {
    supabase,
    kind: 'leads',
    id: inserted.id,
    leadRef,
    data: payload,
    submittedAt,
  })
  if (mailResult.ok) {
    leadsLog('info', 'inquiry.accepted', { leadRef, inquiryType: data.inquiry_type, mail: true })
  }
  return inquiryPublicResult({ mailResult, leadId: inserted.id, leadRef, duplicate: false, idempotent: false })
}

async function dispatchPartner(io, supabase, data, idempotencyKey) {
  const { data: existing, error: keyErr } = await io.findCareerReplay(supabase, idempotencyKey)
  if (keyErr) return { status: 500, body: { ok: false, stored: false, mail: false, code: 'storage-failed' } }
  if (existing) return finishExisting(io, supabase, existing, { kind: 'career', duplicate: true, idempotent: true })

  const { duplicate, error: dupErr } = await io.findRecentCareerReplay(supabase, {
    email: data.email,
    withinSeconds: 60,
  })
  if (dupErr) return { status: 500, body: { ok: false, stored: false, mail: false, code: 'storage-failed' } }
  if (duplicate) return finishExisting(io, supabase, duplicate, { kind: 'career', duplicate: true, idempotent: false })

  const leadRef = io.makeLeadRef('partner')
  const submittedAt = io.now()
  const payload = { ...persistable(data), received_at: submittedAt }
  const { data: inserted, error: insertError } = await io.insertCareer(supabase, {
    application_ref: leadRef,
    status: 'new',
    email: data.email,
    full_name: data.name,
    consent_at: submittedAt,
    source_page: data.source_page,
    idempotency_key: idempotencyKey,
    payload,
  })
  if (insertError) {
    if (insertError.code === '23505') {
      const raced = await io.findCareerReplay(supabase, idempotencyKey)
      if (raced.data) {
        return finishExisting(io, supabase, raced.data, { kind: 'career', duplicate: true, idempotent: true })
      }
    }
    leadsLog('error', 'inquiry.insert_failed', { inquiryType: 'partner', code: insertError.code || 'unknown' })
    return { status: 500, body: { ok: false, stored: false, mail: false, code: 'storage-failed' } }
  }

  await io.writeAudit(supabase, {
    careerId: inserted.id,
    eventType: 'inquiry.accepted',
    detail: { lead_ref: leadRef, inquiry_type: 'partner' },
  })

  const mailResult = await deliverMail(io, {
    supabase,
    kind: 'career',
    id: inserted.id,
    leadRef,
    data: payload,
    submittedAt,
  })
  if (mailResult.ok) leadsLog('info', 'inquiry.accepted', { leadRef, inquiryType: 'partner', mail: true })
  return inquiryPublicResult({ mailResult, leadId: inserted.id, leadRef, duplicate: false, idempotent: false })
}

export async function dispatchUnifiedInquiry({ request, raw, rlKey }, io = defaultIo()) {
  const validated = validateInquiryPayload(raw)
  if (!validated.ok) {
    await io.consumeRateLimit(rlKey, 'error')
    return { status: 400, body: { ok: false, stored: false, mail: false, code: validated.code } }
  }
  if (validated.honeypotFilled) {
    leadsLog('error', 'intake.honeypot_blocked', { endpoint: 'leads', inquiry: true })
    await io.consumeRateLimit(rlKey, 'error')
    return { status: 403, body: { ok: false, stored: false, mail: false, code: 'request-blocked' } }
  }

  const supabase = io.getSupabase()
  if (!supabase) {
    return { status: 500, body: { ok: false, stored: false, mail: false, code: 'storage-not-configured' } }
  }

  const data = validated.data
  const idempotencyKey = buildIdempotencyKey(request, data)
  if (inquiryStorageKind(data.inquiry_type) === 'career') {
    return dispatchPartner(io, supabase, data, idempotencyKey)
  }
  return dispatchLead(io, supabase, data, idempotencyKey)
}
