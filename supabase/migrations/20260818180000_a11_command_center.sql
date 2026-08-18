-- DTH-A11 Production Command Center (local additive, ops private)
-- Operator command idempotency only. No second exception SoT. No live effects.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ops.operator_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  operator_person_id text NOT NULL,
  operator_role text NOT NULL,
  target_type text,
  target_id text,
  correlation_id text,
  expected_revision text,
  reason text,
  payload_hash text NOT NULL,
  result_code text,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  control_version bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_commands_created_idx
  ON ops.operator_commands (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS operator_commands_type_idx
  ON ops.operator_commands (command_type, created_at DESC);

COMMENT ON TABLE ops.operator_commands IS 'A11 operator command idempotency log. Not domain authority.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

ALTER TABLE ops.operator_commands ENABLE ROW LEVEL SECURITY;

COMMIT;
