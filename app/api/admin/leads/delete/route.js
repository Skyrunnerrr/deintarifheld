import { NextResponse } from 'next/server'
import { getServiceSupabase, softDeleteByEmail } from '@/lib/leads/supabase'

export const runtime = 'nodejs'

function authorized(request) {
  const secret = process.env.LEADS_ADMIN_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${secret}`
}

/** Automated DSGVO delete-by-email (no UI required). */
export async function POST(request) {
  if (!authorized(request)) {
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

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ ok: false, code: 'storage-not-configured' }, { status: 500 })
  }

  const result = await softDeleteByEmail(supabase, email)
  if (result.error) {
    return NextResponse.json({ ok: false, code: 'delete-failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    updated: result.updated,
    ids: result.ids,
  })
}
