-- DTH-A3 B2B qualification + missing-information (local additive)
-- Schema: ops (private). No anon/authenticated grants. No production apply.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;
REVOKE ALL ON SCHEMA ops FROM anon;
REVOKE ALL ON SCHEMA ops FROM authenticated;

CREATE TABLE IF NOT EXISTS ops.case_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  revision integer NOT NULL CHECK (revision >= 1),
  policy_id text NOT NULL DEFAULT 'B2BQualificationPolicyV1',
  policy_version integer NOT NULL DEFAULT 1 CHECK (policy_version >= 1),
  outcome text NOT NULL CHECK (outcome = ANY (ARRAY[
    'QUALIFIED_FOR_CALL',
    'MISSING_INFORMATION',
    'NEEDS_HUMAN_REVIEW',
    'SOURCE_DATA_INVALID'
  ])),
  input_fingerprint text NOT NULL,
  normalized_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocking_reason text,
  is_current boolean NOT NULL DEFAULT true,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, revision)
);

CREATE UNIQUE INDEX IF NOT EXISTS case_qualifications_one_current_uidx
  ON ops.case_qualifications (case_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS case_qualifications_case_idx
  ON ops.case_qualifications (case_id, revision DESC);

CREATE TABLE IF NOT EXISTS ops.qualification_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES ops.case_qualifications(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  requirement_code text NOT NULL,
  field_code text NOT NULL,
  reason_code text NOT NULL,
  required_for text NOT NULL DEFAULT 'CALL_READINESS',
  status text NOT NULL DEFAULT 'OPEN' CHECK (status = ANY (ARRAY[
    'OPEN','RESOLVED','SUPERSEDED','CANCELLED'
  ])),
  qualification_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  superseded_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS qualification_requirements_open_field_uidx
  ON ops.qualification_requirements (case_id, field_code) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS qualification_requirements_open_idx
  ON ops.qualification_requirements (case_id, status) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS ops.qualification_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  field_code text NOT NULL,
  value_text text,
  source_kind text NOT NULL CHECK (source_kind = ANY (ARRAY[
    'PUBLIC_INTAKE','CUSTOMER_REPLY','DOCUMENT_EXTRACTION','HUMAN_CORRECTION','SYNTHETIC_TEST'
  ])),
  source_ref text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qualification_observations_case_idx
  ON ops.qualification_observations (case_id, created_at DESC);

ALTER TABLE ops.case_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.qualification_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.qualification_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA ops FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA ops FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

COMMENT ON SCHEMA ops IS 'DTH private ops domain — A3 qualification; no browser Data API exposure';
COMMENT ON TABLE ops.case_qualifications IS 'A3 current+historical CALL_READY qualification revisions';

COMMIT;
