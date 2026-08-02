-- P3-F2b TG-03 validation — synthetic data only; local disposable DB
-- Invoked after supabase db reset --local

\set ON_ERROR_STOP on

-- FIRST_SLICE_TABLES_EXIST
SELECT to_regclass('public.cases') IS NOT NULL AS cases_ok;
SELECT to_regclass('public.case_notes') IS NOT NULL AS case_notes_ok;
SELECT to_regclass('public.tasks') IS NOT NULL AS tasks_ok;
SELECT to_regclass('public.task_reminders') IS NOT NULL AS reminders_ok;
SELECT to_regclass('public.case_assignments') IS NOT NULL AS assignments_ok;
SELECT to_regclass('public.status_history') IS NOT NULL AS status_history_ok;
SELECT to_regclass('public.communication_events') IS NOT NULL AS comms_ok;
SELECT to_regclass('public.ops_audit_events') IS NOT NULL AS ops_audit_ok;
SELECT to_regclass('public.approval_requests') IS NOT NULL AS approval_req_ok;
SELECT to_regclass('public.approval_decisions') IS NOT NULL AS approval_dec_ok;
SELECT to_regclass('public.transactional_outbox') IS NOT NULL AS outbox_ok;

-- Soft-delete columns on required tables
SELECT COUNT(*) = 4 AS cases_soft_cols
FROM information_schema.columns
WHERE table_schema='public' AND table_name='cases'
  AND column_name IN ('deleted_at','deleted_by_actor_type','deleted_by_actor_id','deletion_reason');

-- Intake tables still present
SELECT to_regclass('public.leads') IS NOT NULL AS leads_ok;
SELECT to_regclass('public.career_applications') IS NOT NULL AS career_ok;
SELECT to_regclass('public.audit_events') IS NOT NULL AS intake_audit_ok;

-- ops_audit distinct from intake audit_events
SELECT to_regclass('public.ops_audit_events') IS NOT NULL
   AND to_regclass('public.audit_events') IS NOT NULL
   AND to_regclass('public.ops_audit_events') IS DISTINCT FROM to_regclass('public.audit_events')
  AS ops_audit_distinct;

-- Forbidden objects absent
SELECT COUNT(*) = 0 AS no_kill_state
FROM information_schema.tables
WHERE table_schema='public' AND table_name ILIKE '%kill_state%';

SELECT COUNT(*) = 0 AS no_commission
FROM information_schema.tables
WHERE table_schema='public' AND table_name ILIKE '%commission%';

SELECT COUNT(*) = 0 AS no_partner_pay
FROM information_schema.tables
WHERE table_schema='public' AND (
  table_name ILIKE '%partner_pay%' OR table_name ILIKE '%partner_payout%' OR table_name ILIKE '%partner_compensation%'
);

-- Public lead insert compatibility (synthetic)
INSERT INTO public.leads (
  lead_ref, page_source, status, payload, email, consent_at, source_page, idempotency_key, lead_type
) VALUES (
  'p3f2b-lead-001', 'unternehmen', 'new', '{}'::jsonb,
  'synth-p3f2b-lead@example.test', now(), '/unternehmen', 'p3f2b-lead-idem-001', 'business_energy'
);

-- Public career insert compatibility (synthetic)
INSERT INTO public.career_applications (
  application_ref, status, payload, email, full_name, consent_at, source_page, idempotency_key
) VALUES (
  'p3f2b-career-001', 'new', '{}'::jsonb,
  'synth-p3f2b-career@example.test', 'Synth Test', now(), '/karriere', 'p3f2b-career-idem-001'
);

-- Cases / notes / tasks / reminders / assignment / status / comms / ops audit / approvals / outbox
WITH c AS (
  INSERT INTO public.cases (case_ref, status, title, source_lead_id, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
  SELECT 'CASE-P3F2B-001', 'open', 'Synthetic case', id, 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'corr-p3f2b-001'
  FROM public.leads WHERE lead_ref='p3f2b-lead-001'
  RETURNING id
)
INSERT INTO public.case_notes (case_id, body, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
SELECT id, 'synthetic note', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'corr-p3f2b-002'
FROM c;

INSERT INTO public.tasks (case_id, title, status, assigned_person_id, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
SELECT id, 'synthetic task', 'open', 'person_synth_owner_dth_local_001', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'corr-p3f2b-003'
FROM public.cases WHERE case_ref='CASE-P3F2B-001';

INSERT INTO public.task_reminders (task_id, remind_at, status, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
SELECT id, now() + interval '1 day', 'scheduled', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'corr-p3f2b-004'
FROM public.tasks WHERE title='synthetic task';

INSERT INTO public.case_assignments (case_id, assigned_person_id, assigned_by_person_id, assigned_by_actor_type, assigned_by_actor_id, correlation_id)
SELECT id, 'person_synth_owner_dth_local_001', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'corr-p3f2b-005'
FROM public.cases WHERE case_ref='CASE-P3F2B-001';

INSERT INTO public.status_history (target_type, target_id, from_status, to_status, changed_by_person_id, changed_by_actor_type, changed_by_actor_id, correlation_id)
SELECT 'case', id, 'open', 'in_progress', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'corr-p3f2b-006'
FROM public.cases WHERE case_ref='CASE-P3F2B-001';

INSERT INTO public.communication_events (case_id, sot_event_type, channel, direction, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
SELECT id, 'OUTBOUND_CONTACT_ATTEMPT', 'email', 'outbound', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'corr-p3f2b-007'
FROM public.cases WHERE case_ref='CASE-P3F2B-001';

INSERT INTO public.ops_audit_events (actor_type, actor_id, action, target_type, target_id, result, source, correlation_id)
VALUES ('PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'case.create', 'case', 'CASE-P3F2B-001', 'success', 'ops_cc', 'corr-p3f2b-008');

INSERT INTO public.approval_requests (requested_action, target_type, target_id, requester_person_id, requester_actor_type, requester_actor_id, reason, correlation_id)
VALUES ('soft_delete_case', 'case', 'CASE-P3F2B-001', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'synthetic', 'corr-p3f2b-009');

INSERT INTO public.approval_decisions (approval_request_id, decision, decided_by_person_id, decided_by_actor_type, decided_by_actor_id, reason, correlation_id)
SELECT id, 'approved', 'person_synth_owner_dth_local_001', 'PERSON_PRINCIPAL', 'person_synth_owner_dth_local_001', 'synthetic', 'corr-p3f2b-010'
FROM public.approval_requests WHERE correlation_id='corr-p3f2b-009';

INSERT INTO public.transactional_outbox (event_type, aggregate_type, aggregate_id, payload_redacted, idempotency_key, correlation_id)
VALUES ('CASE_CREATED', 'case', 'CASE-P3F2B-001', '{}'::jsonb, 'outbox-idem-p3f2b-001', 'corr-p3f2b-011');

-- Outbox idempotency enforced (expect failure on duplicate)
DO $$
BEGIN
  BEGIN
    INSERT INTO public.transactional_outbox (event_type, aggregate_type, aggregate_id, payload_redacted, idempotency_key, correlation_id)
    VALUES ('CASE_CREATED', 'case', 'CASE-P3F2B-001', '{}'::jsonb, 'outbox-idem-p3f2b-001', 'corr-p3f2b-012');
    RAISE EXCEPTION 'OUTBOX_IDEMPOTENCY_NOT_ENFORCED';
  EXCEPTION WHEN unique_violation THEN
    -- expected
    NULL;
  END;
END $$;

-- Soft-delete operation works
UPDATE public.cases
SET deleted_at = now(),
    deleted_by_actor_type = 'PERSON_PRINCIPAL',
    deleted_by_actor_id = 'person_synth_owner_dth_local_001',
    deletion_reason = 'synthetic soft delete'
WHERE case_ref = 'CASE-P3F2B-001';

SELECT deleted_at IS NOT NULL AS soft_delete_works
FROM public.cases WHERE case_ref='CASE-P3F2B-001';

SELECT 'TG03_SQL_PASS' AS result;
