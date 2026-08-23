-- DTH-M11H Operator identity mapping (Supabase Auth subject → stable DTH operator)
-- PURPOSE=Stable operator_id + explicit auth_user_id binding + ACTIVE/DISABLED
-- DOES_NOT=assign roles/capabilities (M11I)
-- DOES_NOT=implement Supabase session verification
-- DOES_NOT=auto-provision operators from auth users

BEGIN;

CREATE TABLE IF NOT EXISTS security.operators (
  operator_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_label text NOT NULL,
  email text,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

CREATE TABLE IF NOT EXISTS security.operator_auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES security.operators (operator_id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

COMMENT ON TABLE security.operators IS
  'Stable DTH human operator identity. Authority via M11I+; not email-based.';
COMMENT ON TABLE security.operator_auth_identities IS
  'Maps verified Supabase auth.users.id subject to security.operators. Invite/provision only.';
COMMENT ON COLUMN security.operator_auth_identities.auth_user_id IS
  'Supabase Auth subject UUID. No FK to auth.users (platform lifecycle decoupled).';

CREATE UNIQUE INDEX IF NOT EXISTS operator_auth_identities_active_auth_user_uidx
  ON security.operator_auth_identities (auth_user_id)
  WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS operator_auth_identities_active_operator_uidx
  ON security.operator_auth_identities (operator_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS operator_auth_identities_auth_user_idx
  ON security.operator_auth_identities (auth_user_id);

ALTER TABLE security.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.operator_auth_identities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE security.operators FROM PUBLIC;
REVOKE ALL ON TABLE security.operator_auth_identities FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE security.operators FROM anon;
    REVOKE ALL ON TABLE security.operator_auth_identities FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE security.operators FROM authenticated;
    REVOKE ALL ON TABLE security.operator_auth_identities FROM authenticated;
  END IF;
END
$$;

REVOKE ALL ON TABLE security.operators FROM dth_grp_runtime, dth_grp_worker, dth_grp_public_intake;
REVOKE ALL ON TABLE security.operator_auth_identities FROM dth_grp_runtime, dth_grp_worker, dth_grp_public_intake;

GRANT SELECT ON TABLE security.operators TO dth_grp_ops_api;
GRANT SELECT ON TABLE security.operator_auth_identities TO dth_grp_ops_api;

-- RLS enabled without policies denies all non-bypass roles; allow ops read-only resolution.
DROP POLICY IF EXISTS dth_m11h_ops_operators_select ON security.operators;
CREATE POLICY dth_m11h_ops_operators_select ON security.operators
  FOR SELECT TO dth_grp_ops_api USING (true);

DROP POLICY IF EXISTS dth_m11h_ops_auth_identities_select ON security.operator_auth_identities;
CREATE POLICY dth_m11h_ops_auth_identities_select ON security.operator_auth_identities
  FOR SELECT TO dth_grp_ops_api USING (true);

COMMIT;
