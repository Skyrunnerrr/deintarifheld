/**
 * Delete / retention eligibility.
 *
 * Soft-delete is not a legal hold. Only `legal_hold === true` is a hold.
 * `anonymized_at` is a redaction / minimisation timestamp, not legal anonymisation.
 * Keeping `firma` on a business row is not an "anonymous" state.
 */

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
  return row?.status === 'deleted' && !isAlreadyRedacted(row)
}

/**
 * Rows that may be redacted or physically deleted.
 * Soft-deleted + `anonymized_at IS NULL` remain eligible unless separately on hold.
 */
export function isEraseEligible(row) {
  if (!row) return false
  if (isLegalHold(row)) return false
  if (isAlreadyRedacted(row)) return false
  return true
}

/** Physical delete may remove unredacted or already-redacted rows, never a legal hold. */
export function isPhysicalEligible(row) {
  if (!row) return false
  return !isLegalHold(row)
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
