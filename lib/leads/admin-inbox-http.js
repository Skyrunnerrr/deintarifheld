import { isAdminAuthorized } from './admin-auth.js'
import { ADMIN_INBOX_HTML, ADMIN_LOGIN_HTML } from './admin-inbox-html.js'
import { INBOX_SECURITY_HEADERS } from './security-headers.js'

export function inboxHtmlResponse(body, { status = 200, setCookie } = {}) {
  const headers = {
    ...INBOX_SECURITY_HEADERS,
    'content-type': 'text/html; charset=utf-8',
  }
  if (setCookie) headers['set-cookie'] = setCookie
  return new Response(body, { status, headers })
}

export function inboxLoginPage(message = '', status = 401) {
  const injected = message
    ? ADMIN_LOGIN_HTML.replace('<!--ERR-->', `<div class="err">${message}</div>`)
    : ADMIN_LOGIN_HTML.replace('<!--ERR-->', '')
  return inboxHtmlResponse(injected, { status })
}

export function inboxGetResponse(request) {
  if (isAdminAuthorized(request)) {
    return inboxHtmlResponse(ADMIN_INBOX_HTML)
  }
  return inboxLoginPage()
}
