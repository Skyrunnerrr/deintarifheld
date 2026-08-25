-- DTH-M11M full business data-scope RLS
-- PURPOSE=explicit RLS decision for every runtime business table
-- DOES_NOT=wire app pools to dth_* logins (later credential cutover gate)
-- DOES_NOT=close M11-OPEN-DB-CONTEXT-FORGERY
-- DOES_NOT=retire service_role
-- DOES_NOT=hosted/staging/production apply

BEGIN;

-- ─── Additional policy helpers (M11L helpers remain canonical) ───────────────

CREATE OR REPLACE FUNCTION security.dth_ops_case_read()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_required_capability() IN (
       'CASE_VIEW',
       'TASK_WRITE',
       'NOTE_WRITE',
       'TAKEOVER_MANAGE',
       'WORKFLOW_REPROCESS',
       'PROVIDER_RECONCILE',
       'APPROVAL_DECIDE'
     );
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_content_read()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_required_capability() IN (
       'CONTENT_VIEW',
       'CONTENT_APPROVE',
       'CONTENT_CANCEL',
       'CONTENT_RECONCILE'
     );
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_acquisition_read()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_required_capability() IN (
       'ACQUISITION_VIEW',
       'ACQUISITION_APPROVE',
       'ACQUISITION_ACTIVATE',
       'ACQUISITION_PAUSE',
       'ACQUISITION_RECONCILE'
     );
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_operational_write()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_required_capability() IN (
       'TASK_WRITE',
       'NOTE_WRITE',
       'TAKEOVER_MANAGE',
       'WORKFLOW_REPROCESS',
       'PROVIDER_RECONCILE'
     );
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_approval_write()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_has_capability('APPROVAL_DECIDE');
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_content_write()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_required_capability() IN (
       'CONTENT_APPROVE',
       'CONTENT_CANCEL',
       'CONTENT_RECONCILE'
     );
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_acquisition_write()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_required_capability() IN (
       'ACQUISITION_APPROVE',
       'ACQUISITION_ACTIVATE',
       'ACQUISITION_PAUSE',
       'ACQUISITION_RECONCILE'
     );
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_acquisition_activate()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_has_capability('ACQUISITION_ACTIVATE');
$$;

CREATE OR REPLACE FUNCTION security.dth_ops_workflow_write()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_authority_fresh()
     AND security.dth_context_has_capability('WORKFLOW_REPROCESS');
$$;

REVOKE ALL ON FUNCTION security.dth_ops_case_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_content_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_acquisition_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_operational_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_approval_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_content_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_acquisition_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_acquisition_activate() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_ops_workflow_write() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION security.dth_ops_case_read() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_content_read() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_acquisition_read() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_operational_write() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_approval_write() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_content_write() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_acquisition_write() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_acquisition_activate() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_ops_workflow_write() TO dth_grp_ops_api, dth_grp_worker;

-- ─── Policy installer helpers ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION security.dth_m11m_force_rls(p_schema text, p_table text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_schema, p_table);
  EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_schema, p_table);
END;
$$;

CREATE OR REPLACE FUNCTION security.dth_m11m_drop_policy(p_schema text, p_table text, p_name text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p_name, p_schema, p_table);
END;
$$;

REVOKE ALL ON FUNCTION security.dth_m11m_force_rls(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_m11m_drop_policy(text, text, text) FROM PUBLIC;

-- ─── CASE / QUAL / COMM / CAL / DOC / TARIFF / OFFER / SWITCH / LIFE / RENEWAL ─

DO $$
DECLARE
  t text;
  case_tables text[] := ARRAY[
    'case_qualifications',
    'qualification_observations',
    'qualification_requirements',
    'conversations',
    'communication_messages',
    'outbound_intents',
    'followup_schedules',
    'appointments',
    'appointment_reminders',
    'booking_sessions',
    'booking_slots',
    'documents',
    'document_processing_runs',
    'document_facts',
    'document_fact_conflicts',
    'energy_profiles',
    'tariff_suppliers',
    'tariff_products',
    'tariff_versions',
    'tariff_price_components',
    'tariff_eligibility_rules',
    'tariff_catalogue_snapshots',
    'tariff_catalogue_snapshot_members',
    'tariff_evaluations',
    'tariff_evaluation_results',
    'offers',
    'offer_revisions',
    'offer_options',
    'offer_tokens',
    'offer_customer_decisions',
    'switch_cases',
    'switch_preparations',
    'switch_attempts',
    'switch_requirements',
    'switch_submission_intents',
    'customer_lifecycles',
    'lifecycle_events',
    'lifecycle_handoffs',
    'lifecycle_contract_snapshots',
    'renewal_cycles'
  ];
  provider_tables text[] := ARRAY[
    'provider_events',
    'inbound_events',
    'appointment_provider_events',
    'switch_provider_events',
    'switch_facts',
    'lifecycle_provider_events'
  ];
BEGIN
  FOREACH t IN ARRAY case_tables LOOP
    PERFORM security.dth_m11m_force_rls('ops', t);

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_worker_all');
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_all ON ops.%I FOR ALL TO dth_grp_worker USING (true) WITH CHECK (true)',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_select');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_select ON ops.%I FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_case_read())',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_write');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_write ON ops.%I FOR ALL TO dth_grp_ops_api USING (security.dth_ops_operational_write()) WITH CHECK (security.dth_ops_operational_write())',
      t
    );
  END LOOP;

  -- Provider/system write ownership: worker only; ops read with CASE_VIEW
  FOREACH t IN ARRAY provider_tables LOOP
    PERFORM security.dth_m11m_force_rls('ops', t);

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_worker_all');
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_all ON ops.%I FOR ALL TO dth_grp_worker USING (true) WITH CHECK (true)',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_select');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_select ON ops.%I FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_case_read())',
      t
    );
    -- intentional: no ops INSERT/UPDATE/DELETE policy → operator cannot impersonate provider/system state
  END LOOP;
END
$$;

-- Worker DELETE on catalogue/fact reset tables (matches M11G grants)
DO $$
DECLARE
  t text;
  del_tables text[] := ARRAY[
    'tariff_price_components',
    'tariff_eligibility_rules',
    'tariff_catalogue_snapshot_members',
    'tariff_catalogue_snapshots',
    'tariff_evaluation_results',
    'tariff_evaluations',
    'energy_profiles',
    'tariff_versions',
    'tariff_products',
    'tariff_suppliers',
    'switch_facts'
  ];
BEGIN
  FOREACH t IN ARRAY del_tables LOOP
    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_worker_delete');
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_delete ON ops.%I FOR DELETE TO dth_grp_worker USING (true)',
      t
    );
  END LOOP;
END
$$;

-- ─── APPROVALS ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  approval_tables text[] := ARRAY[
    'offer_approvals',
    'switch_approvals'
  ];
BEGIN
  FOREACH t IN ARRAY approval_tables LOOP
    PERFORM security.dth_m11m_force_rls('ops', t);

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_worker_all');
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_all ON ops.%I FOR ALL TO dth_grp_worker USING (true) WITH CHECK (true)',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_select');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_select ON ops.%I FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_case_read())',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_write');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_write ON ops.%I FOR ALL TO dth_grp_ops_api USING (security.dth_ops_approval_write()) WITH CHECK (security.dth_ops_approval_write())',
      t
    );
  END LOOP;
END
$$;

-- ─── CONTENT ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  content_tables text[] := ARRAY[
    'content_briefs',
    'content_items',
    'content_revisions',
    'content_claims',
    'content_publication_intents',
    'content_publications',
    'content_metric_snapshots',
    'content_approvals'
  ];
BEGIN
  FOREACH t IN ARRAY content_tables LOOP
    PERFORM security.dth_m11m_force_rls('ops', t);

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_worker_all');
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_all ON ops.%I FOR ALL TO dth_grp_worker USING (true) WITH CHECK (true)',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_select');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_select ON ops.%I FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_content_read())',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_write');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_write ON ops.%I FOR ALL TO dth_grp_ops_api USING (security.dth_ops_content_write()) WITH CHECK (security.dth_ops_content_write())',
      t
    );
  END LOOP;
END
$$;

-- ─── ACQUISITION ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  acq_tables text[] := ARRAY[
    'acquisition_campaigns',
    'acquisition_campaign_revisions',
    'acquisition_metric_snapshots',
    'acquisition_refs',
    'acquisition_touchpoints',
    'lead_attributions',
    'campaign_approvals'
  ];
  acq_provider text[] := ARRAY[
    'acquisition_provider_intents',
    'acquisition_provider_campaigns'
  ];
BEGIN
  FOREACH t IN ARRAY acq_tables LOOP
    PERFORM security.dth_m11m_force_rls('ops', t);

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_worker_all');
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_all ON ops.%I FOR ALL TO dth_grp_worker USING (true) WITH CHECK (true)',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_select');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_select ON ops.%I FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_acquisition_read())',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_write');
    IF t = 'acquisition_campaigns' THEN
      -- activate/pause/approve/reconcile all map through acquisition_write helpers;
      -- ACTIVATE is exact for spend-impacting campaign row mutation paths that set provider live.
      EXECUTE format(
        'CREATE POLICY dth_m11m_ops_write ON ops.%I FOR ALL TO dth_grp_ops_api USING (security.dth_ops_acquisition_write()) WITH CHECK (security.dth_ops_acquisition_write())',
        t
      );
    ELSIF t = 'campaign_approvals' THEN
      EXECUTE format(
        'CREATE POLICY dth_m11m_ops_write ON ops.%I FOR ALL TO dth_grp_ops_api USING (security.dth_ops_acquisition_write() OR security.dth_ops_approval_write()) WITH CHECK (security.dth_ops_acquisition_write() OR security.dth_ops_approval_write())',
        t
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY dth_m11m_ops_write ON ops.%I FOR ALL TO dth_grp_ops_api USING (security.dth_ops_acquisition_write()) WITH CHECK (security.dth_ops_acquisition_write())',
        t
      );
    END IF;
  END LOOP;

  FOREACH t IN ARRAY acq_provider LOOP
    PERFORM security.dth_m11m_force_rls('ops', t);

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_worker_all');
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_all ON ops.%I FOR ALL TO dth_grp_worker USING (true) WITH CHECK (true)',
      t
    );

    PERFORM security.dth_m11m_drop_policy('ops', t, 'dth_m11m_ops_select');
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_select ON ops.%I FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_acquisition_read())',
      t
    );
    -- no ops write → operator cannot forge provider campaign state
  END LOOP;
END
$$;

-- Intake acquisition attribution (narrow)
DROP POLICY IF EXISTS dth_m11m_intake_acquisition_refs_select ON ops.acquisition_refs;
CREATE POLICY dth_m11m_intake_acquisition_refs_select ON ops.acquisition_refs
  FOR SELECT TO dth_grp_public_intake USING (true);

DROP POLICY IF EXISTS dth_m11m_intake_touchpoints_select ON ops.acquisition_touchpoints;
CREATE POLICY dth_m11m_intake_touchpoints_select ON ops.acquisition_touchpoints
  FOR SELECT TO dth_grp_public_intake USING (true);

DROP POLICY IF EXISTS dth_m11m_intake_touchpoints_insert ON ops.acquisition_touchpoints;
CREATE POLICY dth_m11m_intake_touchpoints_insert ON ops.acquisition_touchpoints
  FOR INSERT TO dth_grp_public_intake WITH CHECK (true);

DROP POLICY IF EXISTS dth_m11m_intake_lead_attributions_select ON ops.lead_attributions;
CREATE POLICY dth_m11m_intake_lead_attributions_select ON ops.lead_attributions
  FOR SELECT TO dth_grp_public_intake USING (true);

DROP POLICY IF EXISTS dth_m11m_intake_lead_attributions_insert ON ops.lead_attributions;
CREATE POLICY dth_m11m_intake_lead_attributions_insert ON ops.lead_attributions
  FOR INSERT TO dth_grp_public_intake WITH CHECK (true);

-- ─── PUBLIC CASE / LEADS / OUTBOX ────────────────────────────────────────────

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;

-- career_applications: intentional deny-all for runtime (no grants, no policies)
ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_applications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dth_m11m_worker_cases_select ON public.cases;
CREATE POLICY dth_m11m_worker_cases_select ON public.cases
  FOR SELECT TO dth_grp_worker USING (true);
DROP POLICY IF EXISTS dth_m11m_worker_cases_insert ON public.cases;
CREATE POLICY dth_m11m_worker_cases_insert ON public.cases
  FOR INSERT TO dth_grp_worker WITH CHECK (true);

DROP POLICY IF EXISTS dth_m11m_ops_cases_select ON public.cases;
CREATE POLICY dth_m11m_ops_cases_select ON public.cases
  FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_case_read());
DROP POLICY IF EXISTS dth_m11m_ops_cases_update ON public.cases;
CREATE POLICY dth_m11m_ops_cases_update ON public.cases
  FOR UPDATE TO dth_grp_ops_api
  USING (security.dth_ops_operational_write())
  WITH CHECK (security.dth_ops_operational_write());

DROP POLICY IF EXISTS dth_m11m_worker_leads_select ON public.leads;
CREATE POLICY dth_m11m_worker_leads_select ON public.leads
  FOR SELECT TO dth_grp_worker USING (true);
DROP POLICY IF EXISTS dth_m11m_ops_leads_select ON public.leads;
CREATE POLICY dth_m11m_ops_leads_select ON public.leads
  FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_case_read());
-- M11G intake lead policies KEEP

DROP POLICY IF EXISTS dth_m11m_worker_outbox_select ON public.transactional_outbox;
CREATE POLICY dth_m11m_worker_outbox_select ON public.transactional_outbox
  FOR SELECT TO dth_grp_worker USING (true);
DROP POLICY IF EXISTS dth_m11m_worker_outbox_update ON public.transactional_outbox;
CREATE POLICY dth_m11m_worker_outbox_update ON public.transactional_outbox
  FOR UPDATE TO dth_grp_worker USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS dth_m11m_ops_outbox_select ON public.transactional_outbox;
CREATE POLICY dth_m11m_ops_outbox_select ON public.transactional_outbox
  FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_case_read());
-- M11G intake outbox policies KEEP; ops has no UPDATE → cannot impersonate dispatch state

-- ─── WORKFLOW ────────────────────────────────────────────────────────────────

ALTER TABLE workflow.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow.job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.job_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.workflow_instances FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['jobs', 'job_attempts', 'workflow_instances'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS dth_m11m_worker_all ON workflow.%I', t);
    EXECUTE format(
      'CREATE POLICY dth_m11m_worker_all ON workflow.%I FOR ALL TO dth_grp_worker USING (true) WITH CHECK (true)',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS dth_m11m_ops_select ON workflow.%I', t);
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_select ON workflow.%I FOR SELECT TO dth_grp_ops_api USING (security.dth_ops_case_read())',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS dth_m11m_ops_write ON workflow.%I', t);
    EXECUTE format(
      'CREATE POLICY dth_m11m_ops_write ON workflow.%I FOR ALL TO dth_grp_ops_api USING (security.dth_ops_workflow_write()) WITH CHECK (security.dth_ops_workflow_write())',
      t
    );
  END LOOP;
END
$$;

-- ─── Cleanup installer helpers (not runtime policy surface) ──────────────────

DROP FUNCTION IF EXISTS security.dth_m11m_force_rls(text, text);
DROP FUNCTION IF EXISTS security.dth_m11m_drop_policy(text, text, text);

-- FORCE RLS on M11H/I catalog (policies remain open SELECT for ops without human context)
ALTER TABLE security.operators FORCE ROW LEVEL SECURITY;
ALTER TABLE security.operator_auth_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE security.operator_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE security.operator_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE security.role_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE security.operator_role_assignments FORCE ROW LEVEL SECURITY;

COMMIT;
