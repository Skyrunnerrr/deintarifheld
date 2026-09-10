import { ADMIN_INBOX_HTML } from '@/lib/leads/admin-inbox-html'

export const runtime = 'nodejs'

/** Password shell only. Lead rows are fetched from /api/admin/leads after auth. */
export async function GET() {
  return new Response(ADMIN_INBOX_HTML, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'referrer-policy': 'no-referrer',
    },
  })
}
