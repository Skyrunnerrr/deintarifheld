-- DTH-M11G workload-specific least-privilege object grants
-- PURPOSE=Grant exact schema/table authority per workload group (NOT dth_grp_runtime)
-- DOES_NOT=grant ALL ON SCHEMA
-- DOES_NOT=retire service_role

BEGIN;

-- ─── public_intake ───────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO dth_grp_public_intake;
GRANT SELECT, INSERT ON TABLE public.leads TO dth_grp_public_intake;
GRANT SELECT, INSERT, UPDATE ON TABLE public.transactional_outbox TO dth_grp_public_intake;
GRANT INSERT ON TABLE public.audit_events TO dth_grp_public_intake;

GRANT USAGE ON SCHEMA ops TO dth_grp_public_intake;
GRANT SELECT ON TABLE ops.acquisition_refs TO dth_grp_public_intake;
GRANT SELECT, INSERT ON TABLE ops.acquisition_touchpoints TO dth_grp_public_intake;
GRANT SELECT, INSERT ON TABLE ops.lead_attributions TO dth_grp_public_intake;

-- ─── worker ──────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public, ops, security, workflow TO dth_grp_worker;

GRANT SELECT ON TABLE security.control_state TO dth_grp_worker;
GRANT SELECT ON TABLE security.control_version TO dth_grp_worker;

GRANT SELECT, INSERT, UPDATE ON TABLE workflow.jobs TO dth_grp_worker;
GRANT SELECT, INSERT, UPDATE ON TABLE workflow.workflow_instances TO dth_grp_worker;
GRANT SELECT, INSERT, UPDATE ON TABLE workflow.job_attempts TO dth_grp_worker;

GRANT SELECT, UPDATE ON TABLE public.transactional_outbox TO dth_grp_worker;
GRANT SELECT ON TABLE public.leads TO dth_grp_worker;
GRANT SELECT, INSERT ON TABLE public.cases TO dth_grp_worker;
GRANT INSERT ON TABLE public.audit_events TO dth_grp_worker;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'ops' AND tablename <> 'operator_commands'
    ORDER BY tablename
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE ON TABLE ops.%I TO dth_grp_worker',
      t
    );
  END LOOP;
END
$$;

-- Catalogue / fact reset paths (a7/catalogue.js, a9/prepare.js).
GRANT DELETE ON TABLE
  ops.tariff_price_components,
  ops.tariff_eligibility_rules,
  ops.tariff_catalogue_snapshot_members,
  ops.tariff_catalogue_snapshots,
  ops.tariff_evaluation_results,
  ops.tariff_evaluations,
  ops.energy_profiles,
  ops.tariff_versions,
  ops.tariff_products,
  ops.tariff_suppliers,
  ops.switch_facts
TO dth_grp_worker;

-- ─── ops_api ─────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public, ops, security, workflow TO dth_grp_ops_api;

GRANT SELECT, INSERT ON TABLE security.control_state TO dth_grp_ops_api;
GRANT SELECT, UPDATE ON TABLE security.control_version TO dth_grp_ops_api;
GRANT INSERT ON TABLE security.control_audit TO dth_grp_ops_api;

GRANT SELECT, INSERT, UPDATE ON TABLE workflow.jobs TO dth_grp_ops_api;
GRANT SELECT, INSERT, UPDATE ON TABLE workflow.workflow_instances TO dth_grp_ops_api;
GRANT SELECT, INSERT, UPDATE ON TABLE workflow.job_attempts TO dth_grp_ops_api;

GRANT SELECT ON TABLE public.leads TO dth_grp_ops_api;
GRANT SELECT, UPDATE ON TABLE public.cases TO dth_grp_ops_api;
GRANT SELECT, INSERT ON TABLE public.audit_events TO dth_grp_ops_api;
GRANT SELECT ON TABLE public.transactional_outbox TO dth_grp_ops_api;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'ops' ORDER BY tablename
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE ON TABLE ops.%I TO dth_grp_ops_api',
      t
    );
  END LOOP;
END
$$;

-- Explicit deny: marker group must remain without object privileges.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dth_grp_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM dth_grp_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA security FROM dth_grp_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA workflow FROM dth_grp_runtime;

COMMIT;
