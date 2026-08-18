-- DTH-A9 Switching Workflow (local additive, ops private)
-- Exact A8 accepted-offer binding. No live supplier. No bank/IBAN.
-- Domain kill: KillDomain.AUTOMATION_ENGINE (no 9th KillDomain).

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

ALTER TABLE ops.outbound_intents DROP CONSTRAINT IF EXISTS outbound_intents_purpose_check;
ALTER TABLE ops.outbound_intents ADD CONSTRAINT outbound_intents_purpose_check CHECK (purpose = ANY (ARRAY[
  'MISSING_INFORMATION_REQUEST',
  'MISSING_INFORMATION_FOLLOWUP',
  'APPOINTMENT_OFFER',
  'APPOINTMENT_CONFIRMATION',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_RESCHEDULE_CONFIRMATION',
  'APPOINTMENT_CANCELLATION_CONFIRMATION',
  'OFFER_DELIVERY',
  'OFFER_FOLLOWUP',
  'OFFER_ACCEPTANCE_CONFIRMATION',
  'SWITCH_MISSING_INFORMATION_REQUEST',
  'SWITCH_MISSING_INFORMATION_FOLLOWUP',
  'SWITCH_CONFIRMATION'
]));

CREATE TABLE IF NOT EXISTS ops.switch_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  offer_id uuid NOT NULL REFERENCES ops.offers(id),
  offer_revision_id uuid NOT NULL UNIQUE REFERENCES ops.offer_revisions(id),
  commercial_snapshot_hash text NOT NULL,
  selected_tariff_version_id uuid NOT NULL REFERENCES ops.tariff_versions(id),
  catalogue_snapshot_id uuid,
  switch_type text NOT NULL DEFAULT 'SUPPLIER_CHANGE'
    CHECK (switch_type = 'SUPPLIER_CHANGE'),
  provider_code text NOT NULL DEFAULT 'TEST_SWITCH_V1',
  status text NOT NULL CHECK (status = ANY (ARRAY[
    'PREPARING','MISSING_INFORMATION','READY','APPROVAL_REQUIRED','SUBMITTING',
    'SUPPLIER_PENDING','OUTCOME_UNKNOWN','CONFIRMED','REJECTED',
    'REOFFER_REQUIRED','REVIEW_REQUIRED','RECONCILIATION_REQUIRED'
  ])),
  current_attempt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS switch_cases_case_idx ON ops.switch_cases (case_id);

CREATE TABLE IF NOT EXISTS ops.switch_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_case_id uuid NOT NULL REFERENCES ops.switch_cases(id),
  attempt_no integer NOT NULL CHECK (attempt_no >= 1),
  is_current boolean NOT NULL DEFAULT true,
  state text NOT NULL CHECK (state = ANY (ARRAY[
    'DRAFT','READY','INTENT_CREATED','SUBMISSION_ACCEPTED','SUPPLIER_PENDING',
    'OUTCOME_UNKNOWN','REJECTED','CONFIRMED','SUPERSEDED','REOFFER_REQUIRED','REVIEW_REQUIRED'
  ])),
  payload_hash text,
  payload_snapshot jsonb,
  payload_version integer NOT NULL DEFAULT 1,
  provider_code text NOT NULL DEFAULT 'TEST_SWITCH_V1',
  provider_order_id text,
  requested_start date,
  confirmed_start date,
  supply_point_count integer NOT NULL DEFAULT 1 CHECK (supply_point_count >= 1),
  rejection_category text,
  reoffer_reason text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (switch_case_id, attempt_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS switch_attempts_current_uniq
  ON ops.switch_attempts (switch_case_id) WHERE is_current = true;

CREATE UNIQUE INDEX IF NOT EXISTS switch_attempts_provider_order_uniq
  ON ops.switch_attempts (provider_order_id) WHERE provider_order_id IS NOT NULL;

ALTER TABLE ops.switch_cases
  DROP CONSTRAINT IF EXISTS switch_cases_current_attempt_fk;
ALTER TABLE ops.switch_cases
  ADD CONSTRAINT switch_cases_current_attempt_fk
  FOREIGN KEY (current_attempt_id) REFERENCES ops.switch_attempts(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS ops.switch_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_case_id uuid NOT NULL REFERENCES ops.switch_cases(id) ON DELETE CASCADE,
  field_code text NOT NULL,
  value_text text NOT NULL,
  source text NOT NULL CHECK (source = ANY (ARRAY[
    'A2_INTAKE','A3_REPLY','A6_DOCUMENT','A8_ACCEPTED_OFFER','HUMAN_VERIFIED','PROVIDER_RETURNED'
  ])),
  commercial_relevant boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS switch_facts_case_field_idx
  ON ops.switch_facts (switch_case_id, field_code, created_at DESC);

CREATE TABLE IF NOT EXISTS ops.switch_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_case_id uuid NOT NULL REFERENCES ops.switch_cases(id) ON DELETE CASCADE,
  field_code text NOT NULL,
  reason_code text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status = ANY (ARRAY['OPEN','SATISFIED','CANCELLED'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  satisfied_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS switch_requirements_open_uniq
  ON ops.switch_requirements (switch_case_id, field_code) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS ops.switch_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_attempt_id uuid NOT NULL UNIQUE REFERENCES ops.switch_attempts(id) ON DELETE CASCADE,
  policy_version integer NOT NULL,
  payload_hash text NOT NULL,
  decision text NOT NULL CHECK (decision = ANY (ARRAY['PENDING','APPROVED','REJECTED'])),
  actor_type text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.switch_submission_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_attempt_id uuid NOT NULL REFERENCES ops.switch_attempts(id),
  payload_hash text NOT NULL,
  provider_code text NOT NULL,
  provider_idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state = ANY (ARRAY[
    'CREATED','ATTEMPTED','PROVIDER_ACCEPTED','OUTCOME_UNKNOWN','FAILED','CANCELLED'
  ])),
  created_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  UNIQUE (switch_attempt_id, payload_hash)
);

CREATE TABLE IF NOT EXISTS ops.switch_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_attempt_id uuid NOT NULL REFERENCES ops.switch_attempts(id),
  replay_key text NOT NULL,
  status text NOT NULL,
  status_rank integer NOT NULL,
  reason_code text,
  product_ref text,
  confirmed_start date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (switch_attempt_id, replay_key)
);

CREATE TABLE IF NOT EXISTS ops.lifecycle_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  offer_revision_id uuid NOT NULL REFERENCES ops.offer_revisions(id),
  switch_attempt_id uuid NOT NULL UNIQUE REFERENCES ops.switch_attempts(id),
  provider_order_id text NOT NULL,
  selected_tariff_version_id uuid NOT NULL,
  confirmed_start date,
  energy_type text,
  supply_point_count integer,
  renewal_scheduled boolean NOT NULL DEFAULT false CHECK (renewal_scheduled = false),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ops.switch_cases IS 'A9 switching case bound 1:1 to an accepted A8 offer revision';
COMMENT ON TABLE ops.switch_attempts IS 'A9 submission attempts; historical rows preserved on correction';
COMMENT ON TABLE ops.lifecycle_handoffs IS 'A10 handoff after SWITCH_CONFIRMED; no renewal in A9';
COMMENT ON COLUMN ops.switch_facts.commercial_relevant IS 'If true, correction requires REOFFER_REQUIRED';

DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

ALTER TABLE ops.switch_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.switch_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.switch_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.switch_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.switch_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.switch_submission_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.switch_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.lifecycle_handoffs ENABLE ROW LEVEL SECURITY;

COMMIT;
