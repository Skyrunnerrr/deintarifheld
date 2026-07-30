/**
 * Redacted structured logging — no email/phone/message/secrets.
 */

export function leadsLog(level, event, fields = {}) {
  const safe = {
    ts: new Date().toISOString(),
    event,
    ...sanitizeFields(fields),
  }
  const line = JSON.stringify(safe)
  if (level === 'error') console.error(line)
  else console.log(line)
}

function sanitizeFields(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields || {})) {
    const key = String(k).toLowerCase()
    if (
      key.includes('email') ||
      key.includes('phone') ||
      key.includes('telefon') ||
      key.includes('message') ||
      key.includes('nachricht') ||
      key.includes('secret') ||
      key.includes('password') ||
      key.includes('token') ||
      key.includes('authorization') ||
      key.includes('service_role') ||
      key.includes('api_key')
    ) {
      continue
    }
    if (typeof v === 'string' && v.length > 200) {
      out[k] = `${v.slice(0, 40)}…`
      continue
    }
    out[k] = v
  }
  return out
}
