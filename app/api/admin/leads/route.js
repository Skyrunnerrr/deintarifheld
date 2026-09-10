import { NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/leads/admin-auth'
import { getServiceSupabase, listOpsInbox } from '@/lib/leads/supabase'

export const runtime = 'nodejs'

function noStore(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    },
  })
}

/** Authorized ops list — full submitted payloads. Not CORS-public. */
export async function GET(request) {
  if (!isAdminAuthorized(request)) {
    return noStore({ ok: false, code: 'unauthorized' }, 401)
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
