import { NextResponse } from 'next/server'
import { enforceAdminAccess } from '@/lib/leads/admin-guard'
import { getServiceSupabase, processLeadDeletion } from '@/lib/leads/supabase'
import { evaluateAdminEraseInput } from '@/lib/leads/admin-erase'
import { applySecurityHeaders } from '@/lib/leads/security-headers'
import { readJsonBody } from '@/lib/leads/read-json-body'

export const runtime = 'nodejs'

function json(body, status = 200, extraHeaders) {
  const response = NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      ...(extraHeaders || {}),
    },
  })
  applySecurityHeaders(response.headers)
  return response
}

/**
 * Admin erase-by-email. Mode is required.
 * Not a legal DSGVO decision: Legal/Ops must choose soft | redact | physical.
 * Shared redacted placeholder is rejected (redacted-placeholder-not-allowed).
 */
export async function POST(request) {
  const gate = await enforceAdminAccess(request)
  if (!gate.ok) {
    return json({ ok: false, code: gate.code }, gate.status, gate.headers)
  }

  const parsed = await readJsonBody(request, { maxBytes: 4096 })
  if (!parsed.ok) {
    return json({ ok: false, code: parsed.code }, parsed.status)
  }
  const body = parsed.data

  const input = evaluateAdminEraseInput({
    email: body.email,
    mode: body.mode,
    channel: body.channel,
  })
  if (!input.ok) {
    // deletion-mode-required | invalid-deletion-mode | redacted-placeholder-not-allowed
    return json({ ok: false, code: input.code }, input.status)
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return json({ ok: false, code: 'storage-not-configured' }, 500)
  }

  const result = await processLeadDeletion(supabase, input.email, {
    channel: input.channel,
    mode: input.mode,
  })
  if (result.error) {
    if (result.code === 'redacted-placeholder-not-allowed' || result.code === 'deletion-mode-required') {
      return json({ ok: false, code: result.code }, 400)
    }
    return json({ ok: false, code: 'delete-failed' }, 500)
  }

  return json({
    ok: true,
    channel: input.channel,
    mode: result.mode,
    legacyAlias: input.legacyAlias || false,
    updated: result.updated,
    careerUpdated: result.careerUpdated,
    ids: result.ids,
    careerIds: result.careerIds,
  })
}
