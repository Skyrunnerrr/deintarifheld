-- DTH-M11J operator command authz evidence columns (additive)
-- PURPOSE=stable operator_id + authority_version + required_capability on command log
-- DOES_NOT=implement session verification or RLS request context

BEGIN;

ALTER TABLE ops.operator_commands
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES security.operators (operator_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS authority_version bigint,
  ADD COLUMN IF NOT EXISTS required_capability text;

COMMENT ON COLUMN ops.operator_commands.operator_id IS
  'M11H stable operator actor. Legacy operator_person_id retained for E2 compatibility.';
COMMENT ON COLUMN ops.operator_commands.authority_version IS
  'M11I authority revision at authorization time.';
COMMENT ON COLUMN ops.operator_commands.required_capability IS
  'M11J capability that authorized this command.';

COMMIT;
