import { NextResponse } from 'next/server'
import { enforceAdminAccess } from '@/lib/leads/admin-guard'
import { getServiceSupabase, softDeleteByEmail } from '@/lib/leads/supabase'
import { applySecurityHeaders } from '@/lib/leads/security-headers'

export const runtime = 'nodejs'

const CHANNELS = new Set(['all', 'business', 'private', 'career'])

function json(body, status = 200, extraHeaders) {
  const response = NextResponse.json(body, {
    status,
    headers: extraHeaders,
  })
  applySecurityHeaders(response.headers)
  return response
}

/** Automated DSGVO delete-by-email across lead channels (no UI required). */
export async function POST(request) {
  const gate = await enforceAdminAccess(request)
  if (!gate.ok) {
    return json({ ok: false, code: gate.code }, gate.status, gate.headers)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, code: 'invalid-payload' }, 400)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    return json({ ok: false, code: 'invalid-email' }, 400)
  }

  const channel = typeof body.channel === 'string' ? body.channel.trim().toLowerCase() : 'all'
  if (!CHANNELS.has(channel)) {
    return json({ ok: false, code: 'invalid-channel' }, 400)
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return json({ ok: false, code: 'storage-not-configured' }, 500)
  }

  const result = await softDeleteByEmail(supabase, email, { channel })
  if (result.error) {
    return json({ ok: false, code: 'delete-failed' }, 500)
  }

  return json({
    ok: true,
    channel,
    updated: result.updated,
    careerUpdated: result.careerUpdated,
    ids: result.ids,
    careerIds: result.careerIds,
  })
}
