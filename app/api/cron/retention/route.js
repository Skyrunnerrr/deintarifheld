import { NextResponse } from 'next/server'
import { getServiceSupabase, runRetention } from '@/lib/leads/supabase'
import { leadsLog } from '@/lib/leads/log'

export const runtime = 'nodejs'

function authorized(request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  const header = request.headers.get('x-cron-secret') || ''
  return header === secret
}

async function handle(request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ ok: false, code: 'storage-not-configured' }, { status: 500 })
  }

  const result = await runRetention(supabase, {
    retentionDays: Number(process.env.LEADS_RETENTION_DAYS || 90),
    privateRetentionDays: Number(process.env.LEADS_PRIVATE_RETENTION_DAYS || process.env.LEADS_RETENTION_DAYS || 90),
    careerRetentionDays: Number(process.env.LEADS_CAREER_RETENTION_DAYS || 183),
  })

  if (result.error) {
    leadsLog('error', 'retention.failed', { code: 'retention-failed' })
    return NextResponse.json({ ok: false, code: 'retention-failed' }, { status: 500 })
  }

  leadsLog('info', 'retention.completed', {
    businessDeleted: result.business,
    privateDeleted: result.private,
    careerDeleted: result.career,
    normalDeleted: result.normal,
  })

  return NextResponse.json({
    ok: true,
    businessDeleted: result.business,
    privateDeleted: result.private,
    careerDeleted: result.career,
    // backward-compatible
    normalDeleted: result.normal,
  })
}

export async function GET(request) {
  return handle(request)
}

export async function POST(request) {
  return handle(request)
}
