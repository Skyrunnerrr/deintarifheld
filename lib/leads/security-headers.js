/** Baseline headers for every Vercel API response. */
export const API_SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
}

/** Tight CSP for the ops inbox HTML (static /ops assets, no unsafe-inline). */
export const INBOX_SECURITY_HEADERS = {
  ...API_SECURITY_HEADERS,
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
}

export function applySecurityHeaders(headers, extra) {
  const target = headers || new Headers()
  const set = (name, value) => {
    if (typeof target.set === 'function') target.set(name, value)
    else target[name] = value
  }
  for (const [name, value] of Object.entries({ ...API_SECURITY_HEADERS, ...(extra || {}) })) {
    set(name, value)
  }
  return target
}

export function nextConfigApiHeaders() {
  return Object.entries(API_SECURITY_HEADERS).map(([key, value]) => ({ key, value }))
}

export function nextConfigInboxHeaders() {
  return Object.entries(INBOX_SECURITY_HEADERS).map(([key, value]) => ({ key, value }))
}
