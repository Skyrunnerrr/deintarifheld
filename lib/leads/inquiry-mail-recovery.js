/**
 * One automatic internal-mail retry for unified inquiry rows.
 * Cron-owned. A user resubmit does not send. No second lead row.
 */
import { leadsLog } from './log.js'
import { sendLeadEmails } from './mail.js'
import { isInquiryType } from './inquiry-contract.js'
import {
  claimCareerMailRetry,
  claimLeadMailRetry,
  getServiceSupabase,
  listFailedInquiryCareers,
  listFailedInquiryLeads,
  updateCareerMailMeta,
  updateLeadMailMeta,
} from './supabase.js'

/** Old enough to be past the initial request, soon enough for the next cron. */
export const INQUIRY_MAIL_RETRY_MIN_AGE_MS = 2 * 60 * 1000

const SAFE_MAIL_CODES = new Set([
  'mail-send-failed',
  'mail-not-configured',
  'mail-mode-unsupported',
  'mail-status-unknown',
])

export function safeMailErrorCode(code) {
  return typeof code === 'string' && SAFE_MAIL_CODES.has(code) ? code : 'mail-send-failed'
}

export function isAutomaticRetryCandidate(row, nowMs, minAgeMs = INQUIRY_MAIL_RETRY_MIN_AGE_MS) {
  if (!row || typeof row !== 'object') return false
  if (row.status === 'deleted') return false
  if (row.mail_status !== 'failed') return false
  const inquiryType = row.payload && typeof row.payload === 'object' ? row.payload.inquiry_type : ''
  if (!isInquiryType(inquiryType)) return false
  const updatedMs = Date.parse(row.updated_at || '')
  if (!Number.isFinite(updatedMs) || !Number.isFinite(nowMs)) return false
  if (nowMs - updatedMs < minAgeMs) return false
  return true
}

function storageKind(kind) {
  return kind === 'career' ? 'career' : 'leads'
}

function mailChannel(inquiryType) {
  if (inquiryType === 'partner') return 'partner'
  if (inquiryType === 'private_energy') return 'private'
  return 'business'
}

function defaultIo() {
  return {
    now: () => new Date().toISOString(),
    minAgeMs: INQUIRY_MAIL_RETRY_MIN_AGE_MS,
    getSupabase: getServiceSupabase,
    listFailedLeads: (supabase, olderThanIso) => listFailedInquiryLeads(supabase, { olderThanIso }),
    listFailedCareers: (supabase, olderThanIso) => listFailedInquiryCareers(supabase, { olderThanIso }),
    claimLead: claimLeadMailRetry,
    claimCareer: claimCareerMailRetry,
    updateLead: updateLeadMailMeta,
    updateCareer: updateCareerMailMeta,
    sendMail: sendLeadEmails,
  }
}

async function recoverOne(io, supabase, row, kind, nowMs, minAgeMs) {
  if (!isAutomaticRetryCandidate(row, nowMs, minAgeMs)) return 'skipped'
  const claim =
    kind === 'career' ? await io.claimCareer(supabase, row.id) : await io.claimLead(supabase, row.id)
  if (claim?.error) return 'claim_error'
  if (!claim?.claimed) return 'not_claimed'

  const data = row.payload
  const leadRef = row.lead_ref || row.application_ref || ''
  const inquiryType = data.inquiry_type
  let mailResult
  try {
    mailResult = await io.sendMail({
      leadRef,
      data,
      submittedAt: new Date(nowMs).toISOString(),
      channel: mailChannel(inquiryType),
    })
  } catch {
    mailResult = { ok: false, code: 'mail-send-failed' }
  }

  const sent = mailResult?.ok === true
  const patch = {
    mailStatus: sent ? 'internal_sent' : 'failed_final',
    mailMode: mailResult?.mode || process.env.LEADS_MAIL_MODE || 'mock',
  }
  const updated =
    kind === 'career'
      ? await io.updateCareer(supabase, row.id, patch)
      : await io.updateLead(supabase, row.id, patch)
  const safe = {
    leadRef,
    inquiryType,
    storage: storageKind(kind),
    code: sent ? undefined : safeMailErrorCode(mailResult?.code),
  }
  if (updated?.error) {
    leadsLog('error', 'inquiry.mail_status_update_failed', {
      leadRef: safe.leadRef,
      inquiryType: safe.inquiryType,
      storage: safe.storage,
      code: 'storage-failed',
    })
    return 'update_error'
  }
  if (!sent) {
    leadsLog('error', 'inquiry.mail_failed_final', {
      leadRef: safe.leadRef,
      inquiryType: safe.inquiryType,
      storage: safe.storage,
      code: safe.code,
    })
    return 'failed_final'
  }
  return 'sent'
}

export async function recoverFailedInquiryMail(io = defaultIo()) {
  const supabase = io.getSupabase()
  if (!supabase) return { ok: false, code: 'storage-not-configured' }

  const nowMs = Date.parse(io.now())
  if (!Number.isFinite(nowMs)) return { ok: false, code: 'recovery-failed' }
  const minAgeMs = Number.isFinite(io.minAgeMs) ? io.minAgeMs : INQUIRY_MAIL_RETRY_MIN_AGE_MS
  const olderThanIso = new Date(nowMs - minAgeMs).toISOString()

  const leadsResult = await io.listFailedLeads(supabase, olderThanIso)
  if (leadsResult?.error) return { ok: false, code: 'recovery-list-failed' }
  const careerResult = await io.listFailedCareers(supabase, olderThanIso)
  if (careerResult?.error) return { ok: false, code: 'recovery-list-failed' }

  const counts = { claimed: 0, sent: 0, failedFinal: 0, skipped: 0 }
  const rows = [
    ...(leadsResult.data || []).map((row) => ({ row, kind: 'leads' })),
    ...(careerResult.data || []).map((row) => ({ row, kind: 'career' })),
  ]
  for (const item of rows) {
    const outcome = await recoverOne(io, supabase, item.row, item.kind, nowMs, minAgeMs)
    if (outcome === 'skipped' || outcome === 'not_claimed' || outcome === 'claim_error') counts.skipped += 1
    if (outcome === 'sent' || outcome === 'failed_final' || outcome === 'update_error') counts.claimed += 1
    if (outcome === 'sent') counts.sent += 1
    if (outcome === 'failed_final') counts.failedFinal += 1
  }
  return { ok: true, ...counts }
}
