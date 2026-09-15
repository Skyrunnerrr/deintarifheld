import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { isProductionRuntime } from './runtime-env.js'

export const ADMIN_COOKIE_NAME = 'dth_admin'
export const ADMIN_SESSION_TTL_SEC = 30 * 60

function hmacHex(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function safeHexEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8')
  const right = Buffer.from(String(b), 'utf8')
  if (left.length !== right.length) {
    timingSafeEqual(right, right)
    return false
  }
  return timingSafeEqual(left, right)
}

export function createAdminSessionValue(secret, now = Date.now()) {
  if (!secret) return ''
  const exp = now + ADMIN_SESSION_TTL_SEC * 1000
  const nonce = randomBytes(16).toString('hex')
  const payload = `v1.${exp}.${nonce}`
  return `${payload}.${hmacHex(secret, payload)}`
}

export function parseAdminSessionValue(secret, value, now = Date.now()) {
  if (!secret || typeof value !== 'string') return false
  const parts = value.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return false
  const [, expRaw, nonce, mac] = parts
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp < now) return false
  if (!/^[a-f0-9]{32}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(mac)) return false
  const payload = `v1.${exp}.${nonce}`
  const expected = hmacHex(secret, payload)
  return safeHexEqual(mac, expected)
}

export function readAdminCookie(request) {
  const raw = request.headers.get('cookie') || ''
  if (!raw) return ''
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${ADMIN_COOKIE_NAME}=`)) {
      return trimmed.slice(ADMIN_COOKIE_NAME.length + 1)
    }
  }
  return ''
}

export function adminCookieHeader(value, { clear = false } = {}) {
  const secure = isProductionRuntime() ? '; Secure' : ''
  if (clear || !value) {
    return `${ADMIN_COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
  }
  return `${ADMIN_COOKIE_NAME}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_SESSION_TTL_SEC}${secure}`
}
