-- DTH-A10 Customer Lifecycle + Renewal (local additive, ops private)
-- A9 remains switch authority. No live provider. TEST policy dates only when explicit.
-- Kill: AUTOMATION_ENGINE.

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
  'SWITCH_CONFIRMATION',
  'SUPPLY_START_CONFIRMATION',
  'RENEWAL_UPCOMING',
  'RENEWAL_EVIDENCE_REQUIRED'
]));

CREATE TABLE IF NOT EXISTS ops.customer_lifecycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  switch_attempt_id uuid NOT NULL UNIQUE REFERENCES ops.switch_attempts(id),
  offer_revision_id uuid NOT NULL REFERENCES ops.offer_revisions(id),
  predecessor_lifecycle_id uuid REFERENCES ops.customer_lifecycles(id),
  energy_type text NOT NULL,
  supply_point_count integer NOT NULL DEFAULT 1 CHECK (supply_point_count >= 1),
  tariff_version_id uuid NOT NULL,
  provider_order_id text NOT NULL,
  requested_start date,
  confirmed_supply_start date NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY[
    'PRE_ACTIVE','ACTIVE','RENEWAL_MONITORING','RENEWAL_DUE','RENEWAL_EVALUATION_PENDING',
    'RENEWAL_OFFER_PENDING','RENEWAL_DECISION_PENDING','EXCEPTION','CANCELLED','ENDED'
  ])),
  exception_code text,
  fingerprint text NOT NULL,
  current_renewal_cycle_id uuid,
  is_current boolean NOT NULL DEFAULT true,
  activated_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_lifecycles_current_scope_uniq
  ON ops.customer_lifecycles (case_id, energy_type, supply_point_count)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS customer_lifecycles_case_idx ON ops.customer_lifecycles (case_id);

CREATE TABLE IF NOT EXISTS ops.lifecycle_contract_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_id uuid NOT NULL REFERENCES ops.customer_lifecycles(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 1),
  supplier_name text,
  product_code text,
  energy_type text NOT NULL,
  contract_start date NOT NULL,
  expected_contract_end date,
  confirmed_contract_end date,
  min_term_months integer,
  min_term_days integer,
  notice_period_days integer,
  notice_deadline date,
  price_guarantee_end date,
  date_policy_id text NOT NULL,
  date_policy_version integer NOT NULL,
  term_incomplete boolean NOT NULL DEFAULT false,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lifecycle_id, revision),
  CHECK (expected_contract_end IS NULL OR expected_contract_end >= contract_start),
  CHECK (confirmed_contract_end IS NULL OR confirmed_contract_end >= contract_start)
);

CREATE TABLE IF NOT EXISTS ops.lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_id uuid NOT NULL REFERENCES ops.customer_lifecycles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lifecycle_events_lc_idx ON ops.lifecycle_events (lifecycle_id, created_at);

CREATE TABLE IF NOT EXISTS ops.renewal_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_id uuid NOT NULL REFERENCES ops.customer_lifecycles(id) ON DELETE CASCADE,
  cycle_no integer NOT NULL CHECK (cycle_no >= 1),
  is_current boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status = ANY (ARRAY[
    'MONITORING','WINDOW_OPEN','EVIDENCE_REQUIRED','EVALUATION_PENDING','OFFER_PENDING',
    'DECISION_PENDING','NO_ELIGIBLE_TARIFF','REJECTED','ACCEPTED_PENDING_FULFILLMENT',
    'COMPLETED','STALE'
  ])),
  window_open date,
  target_action_date date,
  latest_safe_action_date date,
  evaluation_id uuid,
  offer_revision_id uuid,
  policy_id text NOT NULL,
  policy_version integer NOT NULL,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lifecycle_id, cycle_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS renewal_cycles_current_uniq
  ON ops.renewal_cycles (lifecycle_id) WHERE is_current = true;

ALTER TABLE ops.customer_lifecycles
  DROP CONSTRAINT IF EXISTS customer_lifecycles_current_cycle_fk;
ALTER TABLE ops.customer_lifecycles
  ADD CONSTRAINT customer_lifecycles_current_cycle_fk
  FOREIGN KEY (current_renewal_cycle_id) REFERENCES ops.renewal_cycles(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS ops.lifecycle_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_id uuid NOT NULL REFERENCES ops.customer_lifecycles(id) ON DELETE CASCADE,
  replay_key text NOT NULL,
  status text NOT NULL,
  status_rank integer NOT NULL,
  product_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lifecycle_id, replay_key)
);

COMMENT ON TABLE ops.customer_lifecycles IS 'A10 lifecycle: one per confirmed A9 switch; Case is not contract state';
COMMENT ON COLUMN ops.lifecycle_contract_snapshots.price_guarantee_end IS 'Distinct from expected_contract_end';
COMMENT ON TABLE ops.renewal_cycles IS 'Versioned renewal cycles; at most one current per lifecycle';

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

ALTER TABLE ops.customer_lifecycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.lifecycle_contract_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.renewal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.lifecycle_provider_events ENABLE ROW LEVEL SECURITY;

COMMIT;
