/** P3-F3 internal BFF namespace — no public intake registration. */
export const INTERNAL_BFF_PREFIX = '/ops/v1';

export const TASK_STATUSES = Object.freeze(['open', 'in_progress', 'waiting', 'done', 'cancelled']);
export const CASE_STATUSES = Object.freeze(['open', 'in_progress', 'waiting', 'done', 'cancelled']);

export const LimitedWriteOperation = Object.freeze({
  INTERNAL_NOTE_CREATE: 'INTERNAL_NOTE_CREATE',
  CONTACT_ATTEMPT_RECORD: 'CONTACT_ATTEMPT_RECORD',
  TASK_CREATE: 'TASK_CREATE',
  TASK_STATUS_UPDATE: 'TASK_STATUS_UPDATE',
  ASSIGNMENT_SET: 'ASSIGNMENT_SET',
  CASE_STATUS_APPEND: 'CASE_STATUS_APPEND',
  APPROVAL_REQUEST_CREATE: 'APPROVAL_REQUEST_CREATE',
  APPROVAL_DECISION_OWNER_ONLY: 'APPROVAL_DECISION_OWNER_ONLY',
  KILL_STATE_CHANGE_OWNER_ONLY: 'KILL_STATE_CHANGE_OWNER_ONLY',
});
