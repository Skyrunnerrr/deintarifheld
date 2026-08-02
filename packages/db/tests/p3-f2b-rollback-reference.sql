-- P3-F2b safe-down reference validation on disposable local DB only.
-- Drops first-slice objects in reverse dependency order; must preserve leads/career/audit_events.
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS public.transactional_outbox CASCADE;
DROP TABLE IF EXISTS public.approval_decisions CASCADE;
DROP TABLE IF EXISTS public.approval_requests CASCADE;
DROP TABLE IF EXISTS public.ops_audit_events CASCADE;
DROP TABLE IF EXISTS public.communication_events CASCADE;
DROP TABLE IF EXISTS public.status_history CASCADE;
DROP TABLE IF EXISTS public.case_assignments CASCADE;
DROP TABLE IF EXISTS public.task_reminders CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.case_notes CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;

SELECT to_regclass('public.leads') IS NOT NULL AS leads_preserved;
SELECT to_regclass('public.career_applications') IS NOT NULL AS career_preserved;
SELECT to_regclass('public.audit_events') IS NOT NULL AS intake_audit_preserved;
SELECT to_regclass('public.cases') IS NULL AS cases_removed;
SELECT 'ROLLBACK_REFERENCE_PASS' AS result;
