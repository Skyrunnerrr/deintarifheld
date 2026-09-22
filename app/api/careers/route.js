import { NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { consumeRateLimit } from '@/lib/leads/abuse-guard'
import { enforcePublicIntake, isBotLikeSubmit } from '@/lib/leads/intake-guard'
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
import { mailFieldsFromStored, sendLeadEmails } from '@/lib/leads/mail'
import { optionsResponse, withCors } from '@/lib/leads/cors'
import { leadsLog } from '@/lib/leads/log'
import { publicCareersHealth } from '@/lib/leads/public-health'

export const runtime = 'nodejs'

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

export async function OPTIONS(request) {
  return optionsResponse(request)
}

export async function GET(request) {
  return json(request, publicCareersHealth())
}

export async function POST(request) {
  const intake = await enforcePublicIntake(request, { endpoint: 'careers' })
  if (!intake.ok) {
    return errorResponse(request, intake.code, intake.status, intake.headers)
  }
  const { raw, rlKey } = intake

  const validated = validateCareerPayload(raw)
  if (!validated.ok) {
    await consumeRateLimit(rlKey, 'error')
    return errorResponse(request, validated.code, 400)
  }

  if (isBotLikeSubmit(validated)) {
    leadsLog('error', 'intake.honeypot_blocked', { endpoint: 'careers' })
    await consumeRateLimit(rlKey, 'error')
    return errorResponse(request, 'request-blocked', 403)
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
      ...mailFieldsFromStored(existingByKey),
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
      ...mailFieldsFromStored(duplicate),
    })
  }

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
          ...mailFieldsFromStored(raced),
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
    const failEvent =
      mailResult.mode === 'internal_live' ? 'career.internal_mail_failed' : 'career.mail_failed'
    await writeAudit(supabase, {
      careerId: inserted.id,
      eventType: failEvent,
      detail: {
        code: mailResult.code,
        application_ref: leadRef,
        mode: mailResult.mode || 'mock',
        customer_confirmation: mailResult.customerConfirmation || 'n/a',
      },
    })
    if (mailResult.mode === 'internal_live') {
      await writeAudit(supabase, {
        careerId: inserted.id,
        eventType: 'career.customer_confirmation_skipped',
        detail: { application_ref: leadRef, mode: 'internal_live', reason: 'temporary_internal_mode' },
      })
    }
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
      careerId: inserted.id,
      eventType: 'career.internal_mail_sent',
      detail: {
        application_ref: leadRef,
        mode: 'internal_live',
        templateIds: mailResult.templateIds || [],
        provider_email_id: mailResult.providerEmailId || null,
      },
    })
    await writeAudit(supabase, {
      careerId: inserted.id,
      eventType: 'career.customer_confirmation_skipped',
      detail: { application_ref: leadRef, mode: 'internal_live', reason: 'temporary_internal_mode' },
    })
  } else {
    await writeAudit(supabase, {
      careerId: inserted.id,
      eventType: 'career.mail_sent',
      detail: {
        application_ref: leadRef,
        mode: mailResult.mode || 'mock',
        templateIds: mailResult.templateIds || [],
      },
    })
  }

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
