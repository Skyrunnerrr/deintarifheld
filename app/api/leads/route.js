import { NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import {
  checkRateLimit,
  clientIp,
  hasJsonContentType,
  hashClientKey,
  isBlockedOrigin,
  isTooFastSubmit,
  recordRateLimit,
} from '@/lib/leads/abuse-guard'
import { validateUnternehmenPayload } from '@/lib/leads/validate-unternehmen'
import { isPrivatePageSource, validatePrivatePayload } from '@/lib/leads/validate-private'
import {
  findLeadByIdempotencyKey,
  findRecentDuplicate,
  getServiceSupabase,
  insertLead,
  makeLeadRef,
  updateLeadMailMeta,
  writeAudit,
} from '@/lib/leads/supabase'
import { mailFieldsFromStored, sendLeadEmails } from '@/lib/leads/mail'
import { optionsResponse, withCors } from '@/lib/leads/cors'
import { leadsLog } from '@/lib/leads/log'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 12_288

function requestId(request) {
  return request.headers.get('x-request-id')?.trim() || randomUUID()
}

function json(request, body, status = 200, headers) {
  const rid = requestId(request)
  return withCors(
    request,
    NextResponse.json(
      { ...body, requestId: body.requestId || rid },
      { status, headers: { 'x-request-id': rid, ...(headers || {}) } },
    ),
  )
}

function errorResponse(request, code, status, headers) {
  return json(request, { ok: false, code }, status, headers)
}

function rateLimitKey(request) {
  return hashClientKey(clientIp(request), request.headers.get('user-agent') || 'unknown')
}

function buildIdempotencyKey(request, data) {
  const header = request.headers.get('idempotency-key')?.trim()
  if (header && header.length >= 8 && header.length <= 128) return header
  const window = Math.floor(Date.now() / 60_000)
  return createHash('sha256')
    .update(`${data.page_source}|${data.email}|${window}`)
    .digest('hex')
    .slice(0, 48)
}

function mailFields(mailResult) {
  const mode = mailResult.mode || (process.env.LEADS_MAIL_MODE || 'mock')
  const mailStatus = mailResult.mailStatus || (mailResult.ok ? 'accepted' : 'failed')
  const customerConfirmation =
    mailResult.customerConfirmation ||
    (mode === 'internal_live' ? 'skipped' : mode === 'live' ? 'sent' : 'n/a')
  return {
    mail: Boolean(mailResult.ok),
    mailMode: mode,
    mailStatus,
    customerConfirmation,
  }
}

function resolveValidator(raw) {
  const source = typeof raw?.page_source === 'string' ? raw.page_source.trim() : ''
  if (!source || source === 'unternehmen') {
    return { channel: 'business', validated: validateUnternehmenPayload(raw) }
  }
  if (isPrivatePageSource(source)) {
    return { channel: 'private', validated: validatePrivatePayload(raw) }
  }
  if (source === 'career') {
    return { channel: null, validated: { ok: false, code: 'use-careers-endpoint' } }
  }
  return { channel: null, validated: { ok: false, code: 'unsupported-page-source' } }
}

export async function OPTIONS(request) {
  return optionsResponse(request)
}

export async function GET(request) {
  return json(request, {
    ok: true,
    service: 'dth-leads',
    phase: 'B',
    supported: ['unternehmen', 'privat', 'hero-funnel', 'main_funnel'],
    careerEndpoint: '/api/careers',
    mailModeDefault: process.env.LEADS_MAIL_MODE || 'mock',
  })
}

export async function POST(request) {
  if (!hasJsonContentType(request)) {
    return errorResponse(request, 'invalid-content-type', 400)
  }

  if (isBlockedOrigin(request)) {
    return errorResponse(request, 'request-blocked', 403)
  }

  const rlKey = rateLimitKey(request)
  const submitLimit = checkRateLimit(rlKey, 'submit')
  if (!submitLimit.allowed) {
    return errorResponse(request, 'too-many-requests', 429, {
      'Retry-After': String(submitLimit.retryAfter ?? 60),
    })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    recordRateLimit(rlKey, 'error')
    return errorResponse(request, 'invalid-message', 400)
  }

  let raw
  try {
    raw = await request.json()
  } catch {
    recordRateLimit(rlKey, 'error')
    return errorResponse(request, 'invalid-payload', 400)
  }

  const { channel, validated } = resolveValidator(raw)
  if (!validated.ok) {
    recordRateLimit(rlKey, 'error')
    return errorResponse(request, validated.code, validated.code === 'use-careers-endpoint' ? 400 : 400)
  }

  if (validated.honeypotFilled || isTooFastSubmit(validated.data._formLoadedAt)) {
    return json(request, { ok: true, bot: true })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return errorResponse(request, 'storage-not-configured', 500)
  }

  const pageSource = validated.data.page_source
  const leadType = channel === 'private' ? 'private_energy' : 'business_energy'
  const idempotencyKey = buildIdempotencyKey(request, validated.data)

  const { data: existingByKey } = await findLeadByIdempotencyKey(supabase, idempotencyKey)
  if (existingByKey) {
    return json(request, {
      ok: true,
      duplicate: true,
      idempotent: true,
      leadId: existingByKey.id,
      leadRef: existingByKey.lead_ref,
      ...mailFieldsFromStored(existingByKey),
    })
  }

  const { duplicate, error: dupErr } = await findRecentDuplicate(supabase, {
    email: validated.data.email,
    pageSource,
    withinSeconds: 60,
  })
  if (dupErr) {
    leadsLog('error', 'leads.duplicate_check_failed', { code: 'storage-failed' })
    return errorResponse(request, 'storage-failed', 500)
  }
  if (duplicate) {
    return json(request, {
      ok: true,
      duplicate: true,
      leadId: duplicate.id,
      leadRef: duplicate.lead_ref,
      ...mailFieldsFromStored(duplicate),
    })
  }

  recordRateLimit(rlKey, 'submit')

  const leadRef = makeLeadRef(pageSource)
  const submittedAt = new Date().toISOString()
  const { _formLoadedAt, ...payloadFields } = validated.data

  const { data: inserted, error: insertError } = await insertLead(supabase, {
    lead_ref: leadRef,
    page_source: pageSource,
    lead_type: leadType,
    status: 'new',
    email: validated.data.email,
    firma: validated.data.firma || null,
    consent_at: submittedAt,
    source_page: validated.data.source_page,
    idempotency_key: idempotencyKey,
    payload: {
      ...payloadFields,
      lead_type: leadType,
      _formLoadedAt,
      received_at: submittedAt,
    },
  })

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced } = await findLeadByIdempotencyKey(supabase, idempotencyKey)
      if (raced) {
        return json(request, {
          ok: true,
          duplicate: true,
          idempotent: true,
          leadId: raced.id,
          leadRef: raced.lead_ref,
          ...mailFieldsFromStored(raced),
        })
      }
    }
    leadsLog('error', 'leads.insert_failed', { code: insertError.code || 'unknown' })
    await writeAudit(supabase, {
      eventType: 'lead.insert_failed',
      detail: { code: insertError.code || 'unknown', page_source: pageSource, lead_type: leadType },
    })
    return errorResponse(request, 'storage-failed', 500)
  }

  await writeAudit(supabase, {
    leadId: inserted.id,
    eventType: 'lead.accepted',
    detail: { lead_ref: leadRef, page_source: pageSource, lead_type: leadType },
  })

  const mailResult = await sendLeadEmails({
    leadRef,
    data: validated.data,
    submittedAt,
    channel,
  })

  await updateLeadMailMeta(supabase, inserted.id, {
    mailStatus: mailResult.mailStatus || (mailResult.ok ? 'accepted' : 'failed'),
    mailMode: mailResult.mode || process.env.LEADS_MAIL_MODE || 'mock',
  })

  if (!mailResult.ok) {
    const failEvent =
      mailResult.mode === 'internal_live' ? 'lead.internal_mail_failed' : 'lead.mail_failed'
    await writeAudit(supabase, {
      leadId: inserted.id,
      eventType: failEvent,
      detail: {
        code: mailResult.code,
        lead_ref: leadRef,
        mode: mailResult.mode || 'mock',
        lead_type: leadType,
        customer_confirmation: mailResult.customerConfirmation || 'n/a',
      },
    })
    if (mailResult.mode === 'internal_live') {
      await writeAudit(supabase, {
        leadId: inserted.id,
        eventType: 'lead.customer_confirmation_skipped',
        detail: { lead_ref: leadRef, mode: 'internal_live', reason: 'temporary_internal_mode' },
      })
    }
    leadsLog('error', 'leads.mail_failed', {
      leadRef,
      code: mailResult.code,
      retry: 'manual_or_ops',
    })
    return json(
      request,
      {
        ok: true,
        leadId: inserted.id,
        leadRef,
        duplicate: false,
        idempotent: false,
        ...mailFields(mailResult),
        code: mailResult.code,
      },
      202,
    )
  }

  if (mailResult.mode === 'internal_live') {
    await writeAudit(supabase, {
      leadId: inserted.id,
      eventType: 'lead.internal_mail_sent',
      detail: {
        lead_ref: leadRef,
        mode: 'internal_live',
        lead_type: leadType,
        templateIds: mailResult.templateIds || [],
        provider_email_id: mailResult.providerEmailId || null,
      },
    })
    await writeAudit(supabase, {
      leadId: inserted.id,
      eventType: 'lead.customer_confirmation_skipped',
      detail: { lead_ref: leadRef, mode: 'internal_live', reason: 'temporary_internal_mode' },
    })
  } else {
    await writeAudit(supabase, {
      leadId: inserted.id,
      eventType: 'lead.mail_sent',
      detail: {
        lead_ref: leadRef,
        mode: mailResult.mode || 'mock',
        lead_type: leadType,
        templateIds: mailResult.templateIds || [],
      },
    })
  }

  leadsLog('info', 'leads.accepted', { leadRef, mail: true, leadType })

  return json(request, {
    ok: true,
    leadId: inserted.id,
    leadRef,
    duplicate: false,
    idempotent: false,
    ...mailFields(mailResult),
  })
}
