import { NextResponse } from 'next/server'
import { consumeRateLimit } from '@/lib/leads/abuse-guard'
import { enforcePublicIntake, isBotLikeSubmit } from '@/lib/leads/intake-guard'
import { validateCareerPayload } from '@/lib/leads/validate-career'
import {
  findCareerByIdempotencyKey,
  getServiceSupabase,
  insertCareerApplication,
  makeLeadRef,
  updateCareerMailMeta,
  writeAudit,
} from '@/lib/leads/supabase'
import { mailFieldsFromStored, sendLeadEmails } from '@/lib/leads/mail'
import { optionsResponse, withCors } from '@/lib/leads/cors'
import { leadsLog } from '@/lib/leads/log'
import { resolveRequestId } from '@/lib/leads/request-id'
import { buildIdempotencyKey } from '@/lib/leads/idempotency'
import { publicCareersHealth } from '@/lib/leads/public-health'

export const runtime = 'nodejs'

function json(request, body, status = 200, headers) {
  const rid = resolveRequestId(request)
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

async function writeAuditObserved(supabase, payload) {
  const result = await writeAudit(supabase, payload)
  if (result.error) {
    leadsLog('error', 'careers.audit_write_failed', {
      eventType: payload.eventType || 'unknown',
      code: result.error.code || 'unknown',
    })
  }
  return result
}

function mailFields(mailResult) {
  const mode = mailResult.mode || (process.env.LEADS_MAIL_MODE || 'mock')
  const mailStatus = mailResult.mailStatus || (mailResult.ok ? 'accepted' : 'failed')
  const customerConfirmation = mailResult.customerConfirmation || 'n/a'
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

  const idempotencyKey = buildIdempotencyKey(request, validated.data, { scope: 'career' })
  const { data: existingByKey, error: idempotencyError } =
    await findCareerByIdempotencyKey(supabase, idempotencyKey)
  if (idempotencyError) {
    leadsLog('error', 'careers.idempotency_lookup_failed', {
      code: idempotencyError.code || 'unknown',
    })
    return errorResponse(request, 'storage-failed', 500)
  }
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
      const { data: raced, error: raceLookupError } =
        await findCareerByIdempotencyKey(supabase, idempotencyKey)
      if (raceLookupError) {
        leadsLog('error', 'careers.idempotency_race_lookup_failed', {
          code: raceLookupError.code || 'unknown',
        })
      }
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
    await writeAuditObserved(supabase, {
      eventType: 'career.insert_failed',
      detail: { code: insertError.code || 'unknown' },
    })
    return errorResponse(request, 'storage-failed', 500)
  }

  await writeAuditObserved(supabase, {
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

  const mailMeta = await updateCareerMailMeta(supabase, inserted.id, {
    mailStatus: mailResult.mailStatus || (mailResult.ok ? 'accepted' : 'failed'),
    mailMode: mailResult.mode || process.env.LEADS_MAIL_MODE || 'mock',
  })
  if (mailMeta.error) {
    leadsLog('error', 'careers.mail_meta_update_failed', {
      leadRef,
      code: mailMeta.error.code || 'unknown',
    })
    await writeAuditObserved(supabase, {
      careerId: inserted.id,
      eventType: 'career.mail_meta_update_failed',
      detail: { application_ref: leadRef, code: mailMeta.error.code || 'unknown' },
    })
  }

  if (!mailResult.ok) {
    if (mailResult.internalDelivery === 'sent') {
      await writeAuditObserved(supabase, {
        careerId: inserted.id,
        eventType: 'career.internal_mail_sent',
        detail: {
          application_ref: leadRef,
          mode: mailResult.mode || 'live',
          provider_email_id: mailResult.providerEmailId || null,
          outcome: 'partial_success',
        },
      })
      if (mailResult.customerConfirmation === 'failed') {
        await writeAuditObserved(supabase, {
          careerId: inserted.id,
          eventType: 'career.customer_confirmation_failed',
          detail: {
            application_ref: leadRef,
            mode: mailResult.mode || 'live',
            provider_error_code: mailResult.providerErrorCode || null,
          },
        })
      }
    }

    const failEvent =
      mailResult.mode === 'internal_live' ? 'career.internal_mail_failed' : 'career.mail_failed'
    await writeAuditObserved(supabase, {
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
      await writeAuditObserved(supabase, {
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
    await writeAuditObserved(supabase, {
      careerId: inserted.id,
      eventType: 'career.internal_mail_sent',
      detail: {
        application_ref: leadRef,
        mode: 'internal_live',
        templateIds: mailResult.templateIds || [],
        provider_email_id: mailResult.providerEmailId || null,
      },
    })
    await writeAuditObserved(supabase, {
      careerId: inserted.id,
      eventType: 'career.customer_confirmation_skipped',
      detail: { application_ref: leadRef, mode: 'internal_live', reason: 'temporary_internal_mode' },
    })
  } else {
    await writeAuditObserved(supabase, {
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
