/**
 * P3-F3 SoT Alias Lock — API aliases remap to canonical SoT types/tables.
 * FIRST_RESPONSE is a milestone only (not CONTACT_ATTEMPT / not a comms entity).
 * DUAL_WRITE_FORBIDDEN=YES · ALIAS_TABLES_FORBIDDEN=YES
 */

export const SotResourceType = Object.freeze({
  CASE_NOTE: 'CASE_NOTE',
  COMMUNICATION_EVENT: 'COMMUNICATION_EVENT',
  TASK: 'TASK',
  ASSIGNMENT: 'ASSIGNMENT',
  CASE_STATUS: 'CASE_STATUS',
  APPROVAL_REQUEST: 'APPROVAL_REQUEST',
  APPROVAL_DECISION: 'APPROVAL_DECISION',
});

export const SotPersistenceTarget = Object.freeze({
  CASE_NOTE: 'case_notes',
  COMMUNICATION_EVENT: 'communication_events',
  TASK: 'tasks',
  ASSIGNMENT: 'case_assignments',
  CASE_STATUS: 'status_history',
  APPROVAL_REQUEST: 'approval_requests',
  APPROVAL_DECISION: 'approval_decisions',
});

/** API alias → canonical resource type */
export const SOT_ALIAS_MAP = Object.freeze({
  INTERNAL_NOTE: SotResourceType.CASE_NOTE,
  CONTACT_ATTEMPT: SotResourceType.COMMUNICATION_EVENT,
});

/** Stored SoT event type for communication_events (schema CHECK) */
export const COMMUNICATION_EVENT_SOT_TYPE = Object.freeze({
  CONTACT_ATTEMPT: 'OUTBOUND_CONTACT_ATTEMPT',
});

/** Stored SoT event type for case_notes (schema CHECK) */
export const CASE_NOTE_SOT_TYPE = 'CASE_NOTE_RECORDED';

export function resolveSotAlias({ alias, canonicalResourceType } = {}) {
  const hasAlias = alias != null && String(alias).trim() !== '';
  const hasCanonical = canonicalResourceType != null && String(canonicalResourceType).trim() !== '';

  if (!hasAlias && !hasCanonical) {
    return { ok: false, code: 'SOT_TYPE_REQUIRED', status: 422 };
  }

  if (hasAlias) {
    const key = String(alias).trim();
    if (!(key in SOT_ALIAS_MAP)) {
      return { ok: false, code: 'UNKNOWN_ALIAS', status: 422, alias: key };
    }
    const mapped = SOT_ALIAS_MAP[key];
    if (hasCanonical && String(canonicalResourceType).trim() !== mapped) {
      return {
        ok: false,
        code: 'CONFLICTING_ALIAS_AND_CANONICAL',
        status: 422,
        alias: key,
        canonicalResourceType: String(canonicalResourceType).trim(),
        expectedCanonical: mapped,
      };
    }
    return {
      ok: true,
      aliasResolution: 'REMAPPED_FROM_ALIAS',
      alias: key,
      canonicalResourceType: mapped,
      persistenceTarget: SotPersistenceTarget[mapped],
    };
  }

  const canonical = String(canonicalResourceType).trim();
  if (!Object.values(SotResourceType).includes(canonical)) {
    return { ok: false, code: 'UNKNOWN_CANONICAL_RESOURCE_TYPE', status: 422 };
  }
  return {
    ok: true,
    aliasResolution: 'CANONICAL_DIRECT',
    alias: null,
    canonicalResourceType: canonical,
    persistenceTarget: SotPersistenceTarget[canonical],
  };
}
