import { NextResponse } from 'next/server'
import { enforceAdminAccess } from '@/lib/leads/admin-guard'
import { getServiceSupabase, listOpsInbox } from '@/lib/leads/supabase'
import { applySecurityHeaders } from '@/lib/leads/security-headers'

export const runtime = 'nodejs'

function noStore(body, status = 200, extraHeaders) {
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

/** Authorized ops list — full submitted payloads. Not CORS-public. */
export async function GET(request) {
  const gate = await enforceAdminAccess(request)
  if (!gate.ok) {
    return noStore({ ok: false, code: gate.code }, gate.status, gate.headers)
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return noStore({ ok: false, code: 'storage-not-configured' }, 500)
  }

  const url = new URL(request.url)
  const includeDeleted = url.searchParams.get('includeDeleted') === '1'
  const limit = url.searchParams.get('limit')
  const result = await listOpsInbox(supabase, { limit, includeDeleted })
  if (result.error) {
    return noStore({ ok: false, code: 'list-failed' }, 500)
  }

  return noStore({
    ok: true,
    leads: result.leads,
    careers: result.careers,
    counts: {
      leads: result.leads.length,
      careers: result.careers.length,
    },
  })
}
