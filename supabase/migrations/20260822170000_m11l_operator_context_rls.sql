-- DTH-M11L operator-context-aware RLS foundation
-- PURPOSE=enforce trusted M11K request context at DB layer for protected operator paths
-- DOES_NOT=full business-row data-scope policies (M11M)
-- DOES_NOT=hosted/staging/production apply

BEGIN;

-- ─── Context helpers (transaction-local settings only) ───────────────────────

CREATE OR REPLACE FUNCTION security.dth_context_text(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting(p_key, true), '');
$$;

CREATE OR REPLACE FUNCTION security.dth_operator_context_present()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_context_text('dth.operator_id') IS NOT NULL
     AND security.dth_context_text('dth.required_capability') IS NOT NULL
     AND security.dth_context_text('dth.authority_version') IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION security.dth_context_operator_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT NULLIF(security.dth_context_text('dth.operator_id'), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION security.dth_context_required_capability()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_context_text('dth.required_capability');
$$;

CREATE OR REPLACE FUNCTION security.dth_context_authority_version()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT NULLIF(security.dth_context_text('dth.authority_version'), '')::bigint;
$$;

CREATE OR REPLACE FUNCTION security.dth_context_has_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_operator_context_present()
     AND security.dth_context_required_capability() = p_capability;
$$;

CREATE OR REPLACE FUNCTION security.dth_operator_authority_fresh()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, security
AS $$
DECLARE
  v_operator_id uuid;
  v_ctx_version bigint;
  v_ctx_capability text;
  v_op_status text;
  v_active_version bigint;
BEGIN
  IF NOT security.dth_operator_context_present() THEN
    RETURN false;
  END IF;

  v_operator_id := security.dth_context_operator_id();
  v_ctx_version := security.dth_context_authority_version();
  v_ctx_capability := security.dth_context_required_capability();

  IF v_operator_id IS NULL OR v_ctx_version IS NULL OR v_ctx_capability IS NULL THEN
    RETURN false;
  END IF;

  SELECT o.status
  INTO v_op_status
  FROM security.operators o
  WHERE o.operator_id = v_operator_id;

  IF v_op_status IS DISTINCT FROM 'ACTIVE' THEN
    RETURN false;
  END IF;

  SELECT ora.authority_version
  INTO v_active_version
  FROM security.operator_role_assignments ora
  WHERE ora.operator_id = v_operator_id
    AND ora.status = 'ACTIVE'
  ORDER BY ora.authority_version DESC
  LIMIT 1;

  IF v_active_version IS NULL OR v_active_version <> v_ctx_version THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM security.operator_role_assignments ora
    JOIN security.role_capabilities rc ON rc.role_code = ora.role_code
    WHERE ora.operator_id = v_operator_id
      AND ora.status = 'ACTIVE'
      AND rc.capability_code = v_ctx_capability
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION security.dth_context_is_kill_capability()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, security
AS $$
  SELECT security.dth_context_required_capability() IN (
    'GLOBAL_KILL_MANAGE',
    'DOMAIN_KILL_MANAGE'
  );
$$;

REVOKE ALL ON FUNCTION security.dth_context_text(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_operator_context_present() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_context_operator_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_context_required_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_context_authority_version() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_context_has_capability(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_operator_authority_fresh() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.dth_context_is_kill_capability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION security.dth_context_text(text) TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_operator_context_present() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_context_operator_id() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_context_required_capability() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_context_authority_version() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_context_has_capability(text) TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_operator_authority_fresh() TO dth_grp_ops_api, dth_grp_worker;
GRANT EXECUTE ON FUNCTION security.dth_context_is_kill_capability() TO dth_grp_ops_api, dth_grp_worker;

-- ─── Control plane RLS ───────────────────────────────────────────────────────

ALTER TABLE security.control_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.control_state FORCE ROW LEVEL SECURITY;
ALTER TABLE security.control_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.control_version FORCE ROW LEVEL SECURITY;
ALTER TABLE security.control_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.control_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dth_m11l_worker_control_state_select ON security.control_state;
CREATE POLICY dth_m11l_worker_control_state_select ON security.control_state
  FOR SELECT TO dth_grp_worker
  USING (true);

DROP POLICY IF EXISTS dth_m11l_ops_control_state_select ON security.control_state;
CREATE POLICY dth_m11l_ops_control_state_select ON security.control_state
  FOR SELECT TO dth_grp_ops_api
  USING (true);

DROP POLICY IF EXISTS dth_m11l_ops_control_state_write ON security.control_state;
CREATE POLICY dth_m11l_ops_control_state_write ON security.control_state
  FOR ALL TO dth_grp_ops_api
  USING (
    security.dth_operator_authority_fresh()
    AND security.dth_context_is_kill_capability()
  )
  WITH CHECK (
    security.dth_operator_authority_fresh()
    AND security.dth_context_is_kill_capability()
  );

DROP POLICY IF EXISTS dth_m11l_worker_control_version_select ON security.control_version;
CREATE POLICY dth_m11l_worker_control_version_select ON security.control_version
  FOR SELECT TO dth_grp_worker
  USING (true);

DROP POLICY IF EXISTS dth_m11l_ops_control_version_select ON security.control_version;
CREATE POLICY dth_m11l_ops_control_version_select ON security.control_version
  FOR SELECT TO dth_grp_ops_api
  USING (true);

DROP POLICY IF EXISTS dth_m11l_ops_control_version_update ON security.control_version;
CREATE POLICY dth_m11l_ops_control_version_update ON security.control_version
  FOR UPDATE TO dth_grp_ops_api
  USING (
    security.dth_operator_authority_fresh()
    AND security.dth_context_is_kill_capability()
  )
  WITH CHECK (
    security.dth_operator_authority_fresh()
    AND security.dth_context_is_kill_capability()
  );

DROP POLICY IF EXISTS dth_m11l_ops_control_audit_insert ON security.control_audit;
CREATE POLICY dth_m11l_ops_control_audit_insert ON security.control_audit
  FOR INSERT TO dth_grp_ops_api
  WITH CHECK (security.dth_operator_authority_fresh());

-- ─── Operator command log RLS ────────────────────────────────────────────────

ALTER TABLE ops.operator_commands FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dth_m11l_ops_operator_commands_select ON ops.operator_commands;
CREATE POLICY dth_m11l_ops_operator_commands_select ON ops.operator_commands
  FOR SELECT TO dth_grp_ops_api
  USING (security.dth_operator_authority_fresh());

DROP POLICY IF EXISTS dth_m11l_ops_operator_commands_insert ON ops.operator_commands;
CREATE POLICY dth_m11l_ops_operator_commands_insert ON ops.operator_commands
  FOR INSERT TO dth_grp_ops_api
  WITH CHECK (
    security.dth_operator_authority_fresh()
    AND operator_id = security.dth_context_operator_id()
    AND required_capability = security.dth_context_required_capability()
    AND authority_version = security.dth_context_authority_version()
  );

-- ─── Operator audit append (command path) ────────────────────────────────────

DROP POLICY IF EXISTS dth_m11l_ops_audit_insert ON public.audit_events;
CREATE POLICY dth_m11l_ops_audit_insert ON public.audit_events
  FOR INSERT TO dth_grp_ops_api
  WITH CHECK (security.dth_operator_authority_fresh());

DROP POLICY IF EXISTS dth_m11l_ops_audit_select ON public.audit_events;
CREATE POLICY dth_m11l_ops_audit_select ON public.audit_events
  FOR SELECT TO dth_grp_ops_api
  USING (
    security.dth_operator_authority_fresh()
    AND security.dth_context_has_capability('AUDIT_VIEW')
  );

DROP POLICY IF EXISTS dth_m11l_worker_audit_insert ON public.audit_events;
CREATE POLICY dth_m11l_worker_audit_insert ON public.audit_events
  FOR INSERT TO dth_grp_worker
  WITH CHECK (true);

COMMIT;
