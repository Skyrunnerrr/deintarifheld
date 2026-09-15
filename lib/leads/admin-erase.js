import { resolveDeletionMode } from './deletion-mode.js'
import {
  REDACTED_PLACEHOLDER_NOT_ALLOWED,
  isRedactedPlaceholderEmail,
} from './deletion-state.js'

const CHANNELS = new Set(['all', 'business', 'private', 'career'])

/**
 * Shared admin erase-by-email input gate.
 * Rejects the shared redacted placeholder before any lookup or mutation.
 */
export function evaluateAdminEraseInput({ email, mode, channel = 'all' } = {}) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalized || !normalized.includes('@')) {
    return { ok: false, status: 400, code: 'invalid-email' }
  }
  if (isRedactedPlaceholderEmail(normalized)) {
    return { ok: false, status: 400, code: REDACTED_PLACEHOLDER_NOT_ALLOWED }
  }
  const resolvedChannel = typeof channel === 'string' ? channel.trim().toLowerCase() : 'all'
  if (!CHANNELS.has(resolvedChannel)) {
    return { ok: false, status: 400, code: 'invalid-channel' }
  }
  const resolved = resolveDeletionMode(mode)
  if (!resolved.ok) {
    return { ok: false, status: 400, code: resolved.code }
  }
  return {
    ok: true,
    status: 200,
    email: normalized,
    channel: resolvedChannel,
    mode: resolved.mode,
    legacyAlias: resolved.legacyAlias || false,
  }
}
