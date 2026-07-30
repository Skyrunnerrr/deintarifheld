import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
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
import {
  findLeadByIdempotencyKey,
  findRecentDuplicate,
  getServiceSupabase,
  insertLead,
  makeLeadRef,
  writeAudit,
} from '@/lib/leads/supabase'
import { sendLeadEmails } from '@/lib/leads/mail'
import { optionsResponse, withCors } from '@/lib/leads/cors'
import { leadsLog } from '@/lib/leads/log'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 12_288

function json(request, body, status = 200, headers) {
  return withCors(request, NextResponse.json(body, { status, headers }))
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

export async function OPTIONS(request) {
  return optionsResponse(request)
}

export async function GET(request) {
  return json(request, {
    ok: true,
    service: 'dth-leads',
    phase: 'A',
    supported: ['unternehmen'],
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

  const validated = validateUnternehmenPayload(raw)
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
  const { data: existingByKey } = await findLeadByIdempotencyKey(supabase, idempotencyKey)
  if (existingByKey) {
    return json(request, {
      ok: true,
      duplicate: true,
      idempotent: true,
      leadId: existingByKey.id,
      leadRef: existingByKey.lead_ref,
    })
  }

  const { duplicate, error: dupErr } = await findRecentDuplicate(supabase, {
    email: validated.data.email,
    pageSource: 'unternehmen',
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
    })
  }

  recordRateLimit(rlKey, 'submit')

  const leadRef = makeLeadRef('unternehmen')
  const submittedAt = new Date().toISOString()
  const { _formLoadedAt, ...payloadFields } = validated.data

  const { data: inserted, error: insertError } = await insertLead(supabase, {
    lead_ref: leadRef,
    page_source: 'unternehmen',
    status: 'new',
    email: validated.data.email,
    firma: validated.data.firma,
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
      const { data: raced } = await findLeadByIdempotencyKey(supabase, idempotencyKey)
      if (raced) {
        return json(request, {
          ok: true,
          duplicate: true,
          idempotent: true,
          leadId: raced.id,
          leadRef: raced.lead_ref,
        })
      }
    }
    leadsLog('error', 'leads.insert_failed', { code: insertError.code || 'unknown' })
    await writeAudit(supabase, {
      eventType: 'lead.insert_failed',
      detail: { code: insertError.code || 'unknown', page_source: 'unternehmen' },
    })
    return errorResponse(request, 'storage-failed', 500)
  }

  await writeAudit(supabase, {
    leadId: inserted.id,
    eventType: 'lead.accepted',
    detail: { lead_ref: leadRef, page_source: 'unternehmen' },
  })

  const mailResult = await sendLeadEmails({
    leadRef,
    data: validated.data,
    submittedAt,
  })

  if (!mailResult.ok) {
    await writeAudit(supabase, {
      leadId: inserted.id,
      eventType: 'lead.mail_failed',
      detail: { code: mailResult.code, lead_ref: leadRef, mode: mailResult.mode || 'live' },
    })
    leadsLog('error', 'leads.mail_failed', {
      leadRef,
      code: mailResult.code,
      // Retry contract: caller may re-POST with same Idempotency-Key;
      // insert is idempotent; mail is best-effort, no infinite retry loop.
      retry: 'manual_or_ops',
    })
    return json(
      request,
      {
        ok: true,
        leadId: inserted.id,
        leadRef,
        mail: false,
        code: mailResult.code,
      },
      202,
    )
  }

  await writeAudit(supabase, {
    leadId: inserted.id,
    eventType: 'lead.mail_sent',
    detail: { lead_ref: leadRef, mode: mailResult.mode || 'live' },
  })

  leadsLog('info', 'leads.accepted', { leadRef, mail: true })

  return json(request, {
    ok: true,
    leadId: inserted.id,
    leadRef,
    mail: true,
  })
}
