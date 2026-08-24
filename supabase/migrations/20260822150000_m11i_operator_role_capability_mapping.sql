-- DTH-M11I Operator role + capability mapping (canonical human authority model)
-- PURPOSE=role catalog, capability catalog, role-capability matrix, operator assignments
-- DOES_NOT=enforce HTTP/command authorization (M11J)
-- DOES_NOT=per-request DB context (M11K)
-- DOES_NOT=seed real operator role assignments (tests/admin only)

BEGIN;

CREATE TABLE IF NOT EXISTS security.operator_roles (
  role_code text PRIMARY KEY,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DEPRECATED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security.operator_capabilities (
  capability_code text PRIMARY KEY,
  risk_class text NOT NULL CHECK (
    risk_class IN (
      'READ_ONLY',
      'OPERATIONAL',
      'APPROVAL',
      'HIGH_IMPACT_CONTROL',
      'EXTERNAL_EFFECT_CONTROL'
    )
  ),
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DEPRECATED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security.role_capabilities (
  role_code text NOT NULL REFERENCES security.operator_roles (role_code) ON DELETE RESTRICT,
  capability_code text NOT NULL REFERENCES security.operator_capabilities (capability_code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_code, capability_code)
);

CREATE TABLE IF NOT EXISTS security.operator_role_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES security.operators (operator_id) ON DELETE RESTRICT,
  role_code text NOT NULL REFERENCES security.operator_roles (role_code) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
  authority_version bigint NOT NULL CHECK (authority_version > 0),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operator_role_assignments_revoked_at_ck CHECK (
    (status = 'REVOKED' AND revoked_at IS NOT NULL)
    OR (status = 'ACTIVE' AND revoked_at IS NULL)
  )
);

COMMENT ON TABLE security.operator_roles IS
  'Canonical DTH operator role catalog (VIEWER/OPERATOR/APPROVER/OWNER). Not client authority.';
COMMENT ON TABLE security.operator_capabilities IS
  'Canonical capability primitives for M11J authorization. Derived from A11-A13 contracts.';
COMMENT ON TABLE security.role_capabilities IS
  'Explicit role→capability matrix. OWNER has explicit rows (no wildcard).';
COMMENT ON TABLE security.operator_role_assignments IS
  'Operator→role assignment with history. One ACTIVE role per operator (V1).';

CREATE UNIQUE INDEX IF NOT EXISTS operator_role_assignments_one_active_uidx
  ON security.operator_role_assignments (operator_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS operator_role_assignments_operator_idx
  ON security.operator_role_assignments (operator_id, authority_version DESC);

-- ─── Role catalog (A11 canonical) ───────────────────────────────────────────
INSERT INTO security.operator_roles (role_code, description, status)
VALUES
  ('VIEWER', 'Read-only operator surfaces', 'ACTIVE'),
  ('OPERATOR', 'Operational case/workflow controls', 'ACTIVE'),
  ('APPROVER', 'Human approval decisions', 'ACTIVE'),
  ('OWNER', 'Highest-impact operational controls', 'ACTIVE')
ON CONFLICT (role_code) DO NOTHING;

-- ─── Capability catalog (A11-A13 canonical strings) ─────────────────────────
INSERT INTO security.operator_capabilities (capability_code, risk_class, description, status)
VALUES
  ('CASE_VIEW', 'READ_ONLY', 'View case/ops surfaces', 'ACTIVE'),
  ('AUDIT_VIEW', 'READ_ONLY', 'View audit events', 'ACTIVE'),
  ('CONTENT_VIEW', 'READ_ONLY', 'View content autopilot state', 'ACTIVE'),
  ('ACQUISITION_VIEW', 'READ_ONLY', 'View acquisition campaigns', 'ACTIVE'),
  ('TASK_WRITE', 'OPERATIONAL', 'Create/update operator tasks', 'ACTIVE'),
  ('NOTE_WRITE', 'OPERATIONAL', 'Add case notes', 'ACTIVE'),
  ('TAKEOVER_MANAGE', 'OPERATIONAL', 'Takeover/resume cases', 'ACTIVE'),
  ('WORKFLOW_REPROCESS', 'OPERATIONAL', 'Reprocess workflow jobs', 'ACTIVE'),
  ('PROVIDER_RECONCILE', 'OPERATIONAL', 'Reconcile provider domains', 'ACTIVE'),
  ('CONTENT_CANCEL', 'OPERATIONAL', 'Cancel content publication', 'ACTIVE'),
  ('CONTENT_RECONCILE', 'OPERATIONAL', 'Reconcile content publication', 'ACTIVE'),
  ('ACQUISITION_PAUSE', 'OPERATIONAL', 'Pause/cancel acquisition campaigns', 'ACTIVE'),
  ('ACQUISITION_RECONCILE', 'OPERATIONAL', 'Reconcile acquisition campaigns', 'ACTIVE'),
  ('APPROVAL_DECIDE', 'APPROVAL', 'Decide offer/switch approvals', 'ACTIVE'),
  ('CONTENT_APPROVE', 'APPROVAL', 'Approve/reject content revisions', 'ACTIVE'),
  ('ACQUISITION_APPROVE', 'APPROVAL', 'Approve/reject acquisition campaigns', 'ACTIVE'),
  ('GLOBAL_KILL_MANAGE', 'HIGH_IMPACT_CONTROL', 'Set global kill switch', 'ACTIVE'),
  ('DOMAIN_KILL_MANAGE', 'HIGH_IMPACT_CONTROL', 'Set domain kill switch', 'ACTIVE'),
  ('ACQUISITION_ACTIVATE', 'EXTERNAL_EFFECT_CONTROL', 'Activate paid acquisition campaigns', 'ACTIVE')
ON CONFLICT (capability_code) DO NOTHING;

-- ─── Role-capability matrix (explicit; OWNER is not wildcard) ───────────────
INSERT INTO security.role_capabilities (role_code, capability_code)
VALUES
  ('VIEWER', 'CASE_VIEW'),
  ('VIEWER', 'AUDIT_VIEW'),
  ('VIEWER', 'CONTENT_VIEW'),
  ('VIEWER', 'ACQUISITION_VIEW'),
  ('OPERATOR', 'CASE_VIEW'),
  ('OPERATOR', 'AUDIT_VIEW'),
  ('OPERATOR', 'TASK_WRITE'),
  ('OPERATOR', 'NOTE_WRITE'),
  ('OPERATOR', 'TAKEOVER_MANAGE'),
  ('OPERATOR', 'WORKFLOW_REPROCESS'),
  ('OPERATOR', 'PROVIDER_RECONCILE'),
  ('OPERATOR', 'CONTENT_VIEW'),
  ('OPERATOR', 'CONTENT_CANCEL'),
  ('OPERATOR', 'CONTENT_RECONCILE'),
  ('OPERATOR', 'ACQUISITION_VIEW'),
  ('OPERATOR', 'ACQUISITION_PAUSE'),
  ('OPERATOR', 'ACQUISITION_RECONCILE'),
  ('APPROVER', 'CASE_VIEW'),
  ('APPROVER', 'AUDIT_VIEW'),
  ('APPROVER', 'APPROVAL_DECIDE'),
  ('APPROVER', 'NOTE_WRITE'),
  ('APPROVER', 'CONTENT_VIEW'),
  ('APPROVER', 'CONTENT_APPROVE'),
  ('APPROVER', 'ACQUISITION_VIEW'),
  ('APPROVER', 'ACQUISITION_APPROVE'),
  ('OWNER', 'CASE_VIEW'),
  ('OWNER', 'AUDIT_VIEW'),
  ('OWNER', 'CONTENT_VIEW'),
  ('OWNER', 'ACQUISITION_VIEW'),
  ('OWNER', 'TASK_WRITE'),
  ('OWNER', 'NOTE_WRITE'),
  ('OWNER', 'APPROVAL_DECIDE'),
  ('OWNER', 'TAKEOVER_MANAGE'),
  ('OWNER', 'WORKFLOW_REPROCESS'),
  ('OWNER', 'PROVIDER_RECONCILE'),
  ('OWNER', 'CONTENT_APPROVE'),
  ('OWNER', 'CONTENT_CANCEL'),
  ('OWNER', 'CONTENT_RECONCILE'),
  ('OWNER', 'ACQUISITION_APPROVE'),
  ('OWNER', 'ACQUISITION_ACTIVATE'),
  ('OWNER', 'ACQUISITION_PAUSE'),
  ('OWNER', 'ACQUISITION_RECONCILE'),
  ('OWNER', 'GLOBAL_KILL_MANAGE'),
  ('OWNER', 'DOMAIN_KILL_MANAGE')
ON CONFLICT (role_code, capability_code) DO NOTHING;

ALTER TABLE security.operator_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.operator_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.operator_role_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE security.operator_roles FROM PUBLIC;
REVOKE ALL ON TABLE security.operator_capabilities FROM PUBLIC;
REVOKE ALL ON TABLE security.role_capabilities FROM PUBLIC;
REVOKE ALL ON TABLE security.operator_role_assignments FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE security.operator_roles FROM anon;
    REVOKE ALL ON TABLE security.operator_capabilities FROM anon;
    REVOKE ALL ON TABLE security.role_capabilities FROM anon;
    REVOKE ALL ON TABLE security.operator_role_assignments FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE security.operator_roles FROM authenticated;
    REVOKE ALL ON TABLE security.operator_capabilities FROM authenticated;
    REVOKE ALL ON TABLE security.role_capabilities FROM authenticated;
    REVOKE ALL ON TABLE security.operator_role_assignments FROM authenticated;
  END IF;
END
$$;

REVOKE ALL ON TABLE security.operator_roles FROM dth_grp_runtime, dth_grp_worker, dth_grp_public_intake;
REVOKE ALL ON TABLE security.operator_capabilities FROM dth_grp_runtime, dth_grp_worker, dth_grp_public_intake;
REVOKE ALL ON TABLE security.role_capabilities FROM dth_grp_runtime, dth_grp_worker, dth_grp_public_intake;
REVOKE ALL ON TABLE security.operator_role_assignments FROM dth_grp_runtime, dth_grp_worker, dth_grp_public_intake;

GRANT SELECT ON TABLE security.operator_roles TO dth_grp_ops_api;
GRANT SELECT ON TABLE security.operator_capabilities TO dth_grp_ops_api;
GRANT SELECT ON TABLE security.role_capabilities TO dth_grp_ops_api;
GRANT SELECT ON TABLE security.operator_role_assignments TO dth_grp_ops_api;

DROP POLICY IF EXISTS dth_m11i_ops_operator_roles_select ON security.operator_roles;
CREATE POLICY dth_m11i_ops_operator_roles_select ON security.operator_roles
  FOR SELECT TO dth_grp_ops_api USING (true);

DROP POLICY IF EXISTS dth_m11i_ops_operator_capabilities_select ON security.operator_capabilities;
CREATE POLICY dth_m11i_ops_operator_capabilities_select ON security.operator_capabilities
  FOR SELECT TO dth_grp_ops_api USING (true);

DROP POLICY IF EXISTS dth_m11i_ops_role_capabilities_select ON security.role_capabilities;
CREATE POLICY dth_m11i_ops_role_capabilities_select ON security.role_capabilities
  FOR SELECT TO dth_grp_ops_api USING (true);

DROP POLICY IF EXISTS dth_m11i_ops_role_assignments_select ON security.operator_role_assignments;
CREATE POLICY dth_m11i_ops_role_assignments_select ON security.operator_role_assignments
  FOR SELECT TO dth_grp_ops_api USING (true);

COMMIT;
