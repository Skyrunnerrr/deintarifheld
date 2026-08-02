/**
 * P3-F2a draft schema catalog — metadata only.
 * DRAFT_ONLY · DO_NOT_APPLY · no database connection.
 */

export const P3_F2A_DRAFT_ROOT = 'packages/db/migrations/drafts/p3-f2a';

export const P3_F2A_DRAFT_FILES = Object.freeze([
  '000_draft_markers.sql',
  '010_foundation_reference.sql',
  '020_cases.sql',
  '030_case_notes.sql',
  '040_tasks_and_reminders.sql',
  '050_assignments.sql',
  '060_status_history.sql',
  '070_communication_events.sql',
  '080_ops_audit_events.sql',
  '090_approvals.sql',
  '100_transactional_outbox.sql',
  '110_indexes_and_validation.sql',
  '900_safe_down_draft.sql',
]);

/** First-slice tables created by drafts (new objects only). */
export const P3_F2A_FIRST_SLICE_TABLES = Object.freeze([
  'cases',
  'case_notes',
  'tasks',
  'task_reminders',
  'case_assignments',
  'status_history',
  'communication_events',
  'ops_audit_events',
  'approval_requests',
  'approval_decisions',
  'transactional_outbox',
]);

export const P3_F2A_SOFT_DELETE_TABLES = Object.freeze([
  'cases',
  'case_notes',
  'tasks',
  'task_reminders',
  'case_assignments',
  'communication_events',
]);

export const P3_F2A_FORBIDDEN_TABLE_SUBSTRINGS = Object.freeze([
  'commission',
  'partner_pay',
  'partner_payout',
  'partner_compensation',
  'teleson',
  'averion',
  'newsletter_campaign',
  'marketing_send',
  'customer_confirmation',
  'supplier_contract',
  'accounting_',
]);

export const P3_F2A_PROTECTED_SPINE_TABLES = Object.freeze([
  'leads',
  'career_applications',
  'audit_events',
]);

export const P3_F2A_CLAIMS = Object.freeze({
  STRONG_AUTHZ_COMPLETE: false,
  PRODUCTION_RLS_READY: false,
  MIGRATION_APPLICATION_AUTHORIZED: false,
  DRAFT_ONLY: true,
});
