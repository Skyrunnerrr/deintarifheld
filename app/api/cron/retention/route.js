import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/leads/cron-auth'
import { getServiceSupabase, runRetention } from '@/lib/leads/supabase'
import { leadsLog } from '@/lib/leads/log'
import { applySecurityHeaders } from '@/lib/leads/security-headers'

export const runtime = 'nodejs'

function json(body, status = 200) {
  const response = NextResponse.json(body, { status })
  applySecurityHeaders(response.headers)
  return response
}

async function handle(request) {
  if (!isCronAuthorized(request)) {
    return json({ ok: false, code: 'unauthorized' }, 401)
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return json({ ok: false, code: 'storage-not-configured' }, 500)
  }

  const result = await runRetention(supabase, {
    retentionDays: Number(process.env.LEADS_RETENTION_DAYS || 90),
    privateRetentionDays: Number(process.env.LEADS_PRIVATE_RETENTION_DAYS || process.env.LEADS_RETENTION_DAYS || 90),
    careerRetentionDays: Number(process.env.LEADS_CAREER_RETENTION_DAYS || 183),
  })

  if (result.error) {
    leadsLog('error', 'retention.failed', { code: 'retention-failed' })
    return json({ ok: false, code: 'retention-failed' }, 500)
  }

  leadsLog('info', 'retention.completed', {
    businessDeleted: result.business,
    privateDeleted: result.private,
    careerDeleted: result.career,
    normalDeleted: result.normal,
  })

  return json({
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
