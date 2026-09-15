/**
 * Explicit deletion / redaction modes.
 * Legal/Ops chooses the mode. Code does not invent a legal DSGVO decision.
 *
 * SOFT     — technical soft-deactivation (payload intact). Not a legal hold.
 * REDACT   — PII minimisation / redaction. Not legal anonymisation.
 * PHYSICAL — physical row deletion.
 *
 * `anonymise` is a deprecated alias for `redact` only.
 */

export const CANONICAL_DELETION_MODES = Object.freeze(['soft', 'redact', 'physical'])
export const LEGACY_REDACT_ALIAS = 'anonymise'

export function resolveDeletionMode(value) {
  if (value == null || String(value).trim() === '') {
    return { ok: false, code: 'deletion-mode-required' }
  }
  const raw = String(value).trim().toLowerCase()
  if (raw === LEGACY_REDACT_ALIAS) {
    return { ok: true, mode: 'redact', legacyAlias: true }
  }
  if (CANONICAL_DELETION_MODES.includes(raw)) {
    return { ok: true, mode: raw, legacyAlias: false }
  }
  return { ok: false, code: 'invalid-deletion-mode' }
}

export function isDeletionMode(value) {
  return resolveDeletionMode(value).ok
}
