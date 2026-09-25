import { randomUUID } from 'crypto'

const REQUEST_ID_MAX_LENGTH = 80
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/

export function normalizeRequestId(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || raw.length > REQUEST_ID_MAX_LENGTH) return ''
  if (!REQUEST_ID_PATTERN.test(raw)) return ''
  return raw
}

export function resolveRequestId(request) {
  const incoming = normalizeRequestId(request?.headers?.get?.('x-request-id'))
  return incoming || randomUUID()
}
