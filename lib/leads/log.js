/**
 * Structured operational logging with an explicit field allowlist.
 *
 * Customer-provided values are never accepted merely because their field name
 * looks harmless. New log fields must be deliberately added here.
 */

const ALLOWED_LOG_FIELDS = new Set([
  'action',
  'businessDeleted',
  'careerDeleted',
  'code',
  'configProblemCount',
  'endpoint',
  'eventType',
  'expectedAction',
  'googleErrorCode',
  'googleErrorStatus',
  'googleHttpStatus',
  'googleTransportError',
  'hostname',
  'invalidReason',
  'leadRef',
  'leadType',
  'mail',
  'normalDeleted',
  'privateDeleted',
  'provider',
  'publicCode',
  'reason',
  'reasons',
  'retry',
  'score',
  'valid',
])

export function leadsLog(level, event, fields = {}) {
  const safe = {
    ts: new Date().toISOString(),
    event: safeEventName(event),
    ...sanitizeFields(fields),
  }
  const line = JSON.stringify(safe)
  if (level === 'error') console.error(line)
  else console.log(line)
}

function safeEventName(value) {
  const event = String(value || 'unknown')
  return /^[A-Za-z0-9._:-]{1,120}$/.test(event) ? event : 'invalid_event'
}

export function sanitizeLogFields(fields) {
  return sanitizeFields(fields)
}

function sanitizeFields(fields) {
  const out = {}
  for (const [key, value] of Object.entries(fields || {})) {
    if (!ALLOWED_LOG_FIELDS.has(key)) continue

    if (Array.isArray(value)) {
      out[key] = value
        .filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
        .slice(0, 20)
        .map((item) => (typeof item === 'string' ? item.slice(0, 120) : item))
      continue
    }

    if (typeof value === 'string') {
      out[key] = value.slice(0, 200)
      continue
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
      out[key] = value
    }
  }
  return out
}
