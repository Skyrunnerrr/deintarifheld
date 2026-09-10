import { NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/leads/admin-auth'
import { getServiceSupabase, softDeleteByEmail } from '@/lib/leads/supabase'

export const runtime = 'nodejs'

const CHANNELS = new Set(['all', 'business', 'private', 'career'])

/** Automated DSGVO delete-by-email across lead channels (no UI required). */
export async function POST(request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid-payload' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, code: 'invalid-email' }, { status: 400 })
  }

  const channel = typeof body.channel === 'string' ? body.channel.trim().toLowerCase() : 'all'
  if (!CHANNELS.has(channel)) {
    return NextResponse.json({ ok: false, code: 'invalid-channel' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ ok: false, code: 'storage-not-configured' }, { status: 500 })
  }

  const result = await softDeleteByEmail(supabase, email, { channel })
  if (result.error) {
    return NextResponse.json({ ok: false, code: 'delete-failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    channel,
    updated: result.updated,
    careerUpdated: result.careerUpdated,
    ids: result.ids,
    careerIds: result.careerIds,
  })
}
