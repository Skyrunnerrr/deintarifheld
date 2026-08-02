/**
 * P3-F4 read view-models — contracts only; no UI; no mutations.
 * Inbox is a projected read over existing leads + career_applications (no new SoT table).
 */

export const CcPrimaryView = Object.freeze({
  INBOX: 'INBOX',
  CASES: 'CASES',
  TASKS: 'TASKS',
});

export const InboxRequestKind = Object.freeze({
  LEAD: 'LEAD',
  CAREER_APPLICATION: 'CAREER_APPLICATION',
});

export const InboxAssignmentStatus = Object.freeze({
  UNASSIGNED: 'unassigned',
  LINKED_TO_CASE: 'linked_to_case',
});

/** Redact email for list views: keep first char + domain shape. */
export function redactEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '[redacted]';
  }
  const [local, domain] = email.split('@');
  const head = local.slice(0, 1) || '*';
  return `${head}***@${domain}`;
}

export function buildInboxItemFromLead(row, linkedCaseId = null) {
  return Object.freeze({
    canonicalId: row.id,
    canonicalRef: row.lead_ref,
    requestKind: InboxRequestKind.LEAD,
    requestType: row.lead_type || row.page_source || 'lead',
    createdAt: row.created_at,
    status: row.status,
    assignmentStatus: linkedCaseId
      ? InboxAssignmentStatus.LINKED_TO_CASE
      : InboxAssignmentStatus.UNASSIGNED,
    linkedCaseId: linkedCaseId || null,
    contactRedacted: redactEmail(row.email),
    source: row.source_page || row.page_source || null,
  });
}

export function buildInboxItemFromCareer(row, linkedCaseId = null) {
  return Object.freeze({
    canonicalId: row.id,
    canonicalRef: row.application_ref,
    requestKind: InboxRequestKind.CAREER_APPLICATION,
    requestType: 'career',
    createdAt: row.created_at,
    status: row.status,
    assignmentStatus: linkedCaseId
      ? InboxAssignmentStatus.LINKED_TO_CASE
      : InboxAssignmentStatus.UNASSIGNED,
    linkedCaseId: linkedCaseId || null,
    contactRedacted: redactEmail(row.email),
    source: row.source_page || '/karriere',
  });
}
