import { timingSafeEqual } from 'crypto'
import { isProductionRuntime } from './runtime-env.js'

export const MIN_OPS_SECRET_LENGTH = 32

const WEAK_SECRETS = new Set([
  'secret',
  'admin',
  'password',
  'changeme',
  'test',
  'cron',
  'leads',
  'ops-secret-test',
  'ops-admin-only',
  'cron-must-not-open-admin',
  'cron-only-must-fail',
])

/**
 * Constant-time string compare. Length mismatch still performs a dummy compare
 * so the secret length is not leaked via an early return on the expected buffer.
 */
export function safeEqualString(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) {
    timingSafeEqual(b, b)
    return false
  }
  if (a.length === 0) return false
  return timingSafeEqual(a, b)
}

export function isSecretStrong(secret) {
  if (typeof secret !== 'string') return false
  const value = secret.trim()
  if (value.length < MIN_OPS_SECRET_LENGTH) return false
  if (WEAK_SECRETS.has(value.toLowerCase())) return false
  if (/^(.)\1+$/.test(value)) return false
  return true
}

export function usableOpsSecret(raw) {
  const secret = typeof raw === 'string' ? raw.trim() : ''
  if (!secret) return ''
  if (isProductionRuntime() && !isSecretStrong(secret)) return ''
  return secret
}
