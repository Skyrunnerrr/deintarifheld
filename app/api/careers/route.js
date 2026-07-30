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
import { validateCareerPayload } from '@/lib/leads/validate-career'
import {
  findCareerByIdempotencyKey,
  findRecentCareerDuplicate,
  getServiceSupabase,
  insertCareerApplication,
  makeLeadRef,
  updateCareerMailMeta,
  writeAudit,
} from '@/lib/leads/supabase'
import { sendLeadEmails } from '@/lib/leads/mail'
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
    .update(`career|${data.email}|${window}`)
    .digest('hex')
    .slice(0, 48)
}

function mailFields(mailResult) {
  const mode = mailResult.mode || (process.env.LEADS_MAIL_MODE || 'mock')
  const mailStatus = mailResult.mailStatus || (mailResult.ok ? 'accepted' : 'failed')
  return {
    mail: Boolean(mailResult.ok),
    mailMode: mode,
    mailStatus,
  }
}

export async function OPTIONS(request) {
  return optionsResponse(request)
}

export async function GET(request) {
  return json(request, {
    ok: true,
    service: 'dth-careers',
    phase: 'B',
    supported: ['career'],
    fileUploads: false,
    mailModeDefault: 'mock',
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

  const validated = validateCareerPayload(raw)
  if (!validated.ok) {
    recordRateLimit(rlKey, 'error')
    return errorResponse(request, validated.code, 400)
  }

  if (validated.honeypotFilled || isTooFastSubmit(validated.data._formLoadedAt)) {
    return json(request, { ok: true, bot: true })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return errorResponse(request, 'storage-not-configured', 500)
  }

  const idempotencyKey = buildIdempotencyKey(request, validated.data)
  const { data: existingByKey } = await findCareerByIdempotencyKey(supabase, idempotencyKey)
  if (existingByKey) {
    return json(request, {
      ok: true,
      duplicate: true,
      idempotent: true,
      leadId: existingByKey.id,
      leadRef: existingByKey.application_ref,
      mail: true,
      mailMode: process.env.LEADS_MAIL_MODE || 'mock',
      mailStatus: 'accepted',
    })
  }

  const { duplicate, error: dupErr } = await findRecentCareerDuplicate(supabase, {
    email: validated.data.email,
    withinSeconds: 60,
  })
  if (dupErr) {
    leadsLog('error', 'careers.duplicate_check_failed', { code: 'storage-failed' })
    return errorResponse(request, 'storage-failed', 500)
  }
  if (duplicate) {
    return json(request, {
      ok: true,
      duplicate: true,
      leadId: duplicate.id,
      leadRef: duplicate.application_ref,
      mail: true,
      mailMode: process.env.LEADS_MAIL_MODE || 'mock',
      mailStatus: 'accepted',
    })
  }

  recordRateLimit(rlKey, 'submit')

  const leadRef = makeLeadRef('career')
  const submittedAt = new Date().toISOString()
  const { _formLoadedAt, ...payloadFields } = validated.data

  const { data: inserted, error: insertError } = await insertCareerApplication(supabase, {
    application_ref: leadRef,
    status: 'new',
    email: validated.data.email,
    full_name: validated.data.name,
    consent_at: submittedAt,
    source_page: validated.data.source_page,
    idempotency_key: idempotencyKey,
    payload: {
      ...payloadFields,
      _formLoadedAt,
      received_at: submittedAt,
    },
  })

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced } = await findCareerByIdempotencyKey(supabase, idempotencyKey)
      if (raced) {
        return json(request, {
          ok: true,
          duplicate: true,
          idempotent: true,
          leadId: raced.id,
          leadRef: raced.application_ref,
          mail: true,
          mailMode: process.env.LEADS_MAIL_MODE || 'mock',
          mailStatus: 'accepted',
        })
      }
    }
    leadsLog('error', 'careers.insert_failed', { code: insertError.code || 'unknown' })
    await writeAudit(supabase, {
      eventType: 'career.insert_failed',
      detail: { code: insertError.code || 'unknown' },
    })
    return errorResponse(request, 'storage-failed', 500)
  }

  await writeAudit(supabase, {
    careerId: inserted.id,
    eventType: 'career.accepted',
    detail: { application_ref: leadRef },
  })

  const mailResult = await sendLeadEmails({
    leadRef,
    data: validated.data,
    submittedAt,
    channel: 'career',
  })

  await updateCareerMailMeta(supabase, inserted.id, {
    mailStatus: mailResult.mailStatus || (mailResult.ok ? 'accepted' : 'failed'),
    mailMode: mailResult.mode || process.env.LEADS_MAIL_MODE || 'mock',
  })

  if (!mailResult.ok) {
    await writeAudit(supabase, {
      careerId: inserted.id,
      eventType: 'career.mail_failed',
      detail: { code: mailResult.code, application_ref: leadRef, mode: mailResult.mode || 'mock' },
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

  await writeAudit(supabase, {
    careerId: inserted.id,
    eventType: 'career.mail_sent',
    detail: {
      application_ref: leadRef,
      mode: mailResult.mode || 'mock',
      templateIds: mailResult.templateIds || [],
    },
  })

  leadsLog('info', 'careers.accepted', { leadRef, mail: true })

  return json(request, {
    ok: true,
    leadId: inserted.id,
    leadRef,
    duplicate: false,
    idempotent: false,
    ...mailFields(mailResult),
  })
}
