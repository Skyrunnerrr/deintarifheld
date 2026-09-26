import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/leads/cron-auth'
import { leadsLog } from '@/lib/leads/log'
import { applySecurityHeaders } from '@/lib/leads/security-headers'
import { recoverFailedInquiryMail } from '@/lib/leads/inquiry-mail-recovery'

export const runtime = 'nodejs'

function json(body, status = 200) {
  const response = NextResponse.json(body, { status })
  applySecurityHeaders(response.headers)
  return response
}

export async function GET(request) {
  if (!isCronAuthorized(request)) {
    return json({ ok: false, code: 'unauthorized' }, 401)
  }

  const result = await recoverFailedInquiryMail()
  if (!result.ok) {
    leadsLog('error', 'inquiry.mail_recovery_failed', { code: result.code || 'recovery-failed' })
    return json({ ok: false, code: result.code || 'recovery-failed' }, 500)
  }

  leadsLog('info', 'inquiry.mail_recovery_completed', {
    claimed: result.claimed,
    sent: result.sent,
    failedFinal: result.failedFinal,
    skipped: result.skipped,
  })

  return json({
    ok: true,
    claimed: result.claimed,
    sent: result.sent,
    failedFinal: result.failedFinal,
    skipped: result.skipped,
  })
}

export async function POST() {
  return json({ ok: false, code: 'method-not-allowed' }, 405)
}
