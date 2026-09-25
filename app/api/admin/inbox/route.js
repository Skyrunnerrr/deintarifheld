import { adminSecret } from '@/lib/leads/admin-auth'
import { enforceAdminAccess } from '@/lib/leads/admin-guard'
import { ADMIN_INBOX_HTML, ADMIN_LOGIN_HTML } from '@/lib/leads/admin-inbox-html'
import { inboxGetResponse, inboxHtmlResponse, inboxLoginPage } from '@/lib/leads/admin-inbox-http'
import { adminCookieHeader, createAdminSessionValue } from '@/lib/leads/admin-session'
import { safeEqualString } from '@/lib/leads/secret-compare'
import { readBodyText } from '@/lib/leads/read-json-body'

export const runtime = 'nodejs'

/** Password shell is itself gated. Lead rows stay on /api/admin/leads after auth. */
export async function GET(request) {
  return inboxGetResponse(request)
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || ''
  let action = ''
  let provided = ''
  const raw = await readBodyText(request, { maxBytes: 4096 })
  if (!raw.ok) {
    if (raw.status === 413) {
      return inboxHtmlResponse(
        ADMIN_LOGIN_HTML.replace('<!--ERR-->', '<div class="err">Anfrage zu groß.</div>'),
        { status: 413 },
      )
    }
    return inboxLoginPage('Anmeldung fehlgeschlagen.')
  }

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(raw.text)
      action = params.get('action') || ''
      provided = params.get('secret') || ''
    } else if (contentType.includes('application/json')) {
      const body = JSON.parse(raw.text)
      action = typeof body.action === 'string' ? body.action : ''
      provided = typeof body.secret === 'string' ? body.secret : ''
    } else {
      return inboxLoginPage('Anmeldung fehlgeschlagen.')
    }
  } catch {
    return inboxLoginPage('Anmeldung fehlgeschlagen.')
  }

  if (action === 'logout') {
    return inboxHtmlResponse(ADMIN_LOGIN_HTML.replace('<!--ERR-->', ''), {
      setCookie: adminCookieHeader('', { clear: true }),
    })
  }

  const gate = await enforceAdminAccess(
    new Request(request.url, {
      headers: {
        authorization: `Bearer ${provided}`,
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'user-agent': request.headers.get('user-agent') || '',
      },
    }),
  )
  if (!gate.ok) {
    if (gate.status === 429) {
      return inboxHtmlResponse(
        ADMIN_LOGIN_HTML.replace('<!--ERR-->', '<div class="err">Zu viele Versuche. Bitte warten.</div>'),
        { status: 429 },
      )
    }
    return inboxLoginPage('Geheimnis falsch oder nicht gesetzt.')
  }

  const secret = adminSecret()
  if (!secret || !safeEqualString(provided, secret)) {
    return inboxLoginPage('Geheimnis falsch oder nicht gesetzt.')
  }

  const session = createAdminSessionValue(secret)
  return inboxHtmlResponse(ADMIN_INBOX_HTML, {
    setCookie: adminCookieHeader(session),
  })
}
