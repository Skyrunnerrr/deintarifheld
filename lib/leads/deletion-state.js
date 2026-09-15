/**
 * Delete / retention eligibility.
 *
 * Soft-delete is not a legal hold. Only `legal_hold === true` is a hold.
 * Column `anonymized_at` is a technical legacy name for the redaction /
 * minimisation timestamp. It is not legal anonymisation.
 * Keeping `firma` on a business row is not an "anonymous" state.
 */

export const PII_STATES = Object.freeze({
  ACTIVE: 'ACTIVE',
  SOFT_DELETED: 'SOFT_DELETED',
  LEGAL_HOLD: 'LEGAL_HOLD',
  REDACTED: 'REDACTED',
  PHYSICALLY_DELETED: 'PHYSICALLY_DELETED',
})

/** Technical legacy column. Semantic name: redacted / PII-minimised at. */
export const PII_REDACTION_COLUMN = 'anonymized_at'
export const PII_STATE_NAMING = 'legacy_anonymized_at_means_redacted_not_anonymous'

export const REDACTED_EMAIL = 'redacted@invalid.invalid'
/** @deprecated Use REDACTED_EMAIL. Kept as the historic export name. */
export const ANONYMISED_EMAIL = REDACTED_EMAIL

export function isLegalHold(row) {
  return row?.legal_hold === true
}

export function isAlreadyRedacted(row) {
  return row?.anonymized_at != null && String(row.anonymized_at) !== ''
}

export function isSoftDeletedUnredacted(row) {
  return row?.status === 'deleted' && !isAlreadyRedacted(row) && !isLegalHold(row)
}

/**
 * Explicit row state. `status=deleted` alone is never LEGAL_HOLD.
 * PHYSICALLY_DELETED is represented by a missing row (null).
 */
export function classifyPiiState(row) {
  if (row == null) return PII_STATES.PHYSICALLY_DELETED
  if (isLegalHold(row)) return PII_STATES.LEGAL_HOLD
  if (isAlreadyRedacted(row)) return PII_STATES.REDACTED
  if (row.status === 'deleted') return PII_STATES.SOFT_DELETED
  return PII_STATES.ACTIVE
}

/** Historic leftover: soft-deleted, not redacted, not on hold. */
export function isHistoricCleanupEligible(row) {
  return classifyPiiState(row) === PII_STATES.SOFT_DELETED
}

/**
 * Rows that may be redacted or physically deleted.
 * Soft-deleted + `anonymized_at IS NULL` remain eligible unless separately on hold.
 */
export function isEraseEligible(row) {
  const state = classifyPiiState(row)
  return state === PII_STATES.ACTIVE || state === PII_STATES.SOFT_DELETED
}

/** Physical delete may remove unredacted or already-redacted rows, never a legal hold. */
export function isPhysicalEligible(row) {
  if (row == null) return false
  return classifyPiiState(row) !== PII_STATES.LEGAL_HOLD
}

export function isRetentionEligible(row) {
  return isEraseEligible(row)
}

export function filterEraseEligible(rows) {
  return (rows || []).filter(isEraseEligible)
}

export function filterPhysicalEligible(rows) {
  return (rows || []).filter(isPhysicalEligible)
}

export function filterRetentionEligible(rows) {
  return (rows || []).filter(isRetentionEligible)
}

export function filterHistoricCleanupEligible(rows) {
  return (rows || []).filter(isHistoricCleanupEligible)
}

export function safeHistoricRef(row, kind) {
  if (!row) return null
  if (kind === 'career') return row.application_ref || row.id || null
  return row.lead_ref || row.id || null
}
