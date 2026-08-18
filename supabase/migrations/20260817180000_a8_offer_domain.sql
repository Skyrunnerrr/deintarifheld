-- DTH-A8 Offer Engine (local additive, ops private)
-- Copies A7 evaluation numbers into an immutable commercial snapshot.
-- No live customer delivery. No PDF. No DocuSign. No supplier switch.
-- Domain kill: KillDomain.AUTOMATION_ENGINE. Mail: INTERNAL_MAIL via A4.
-- Do not apply to staging/production.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

-- Extend A4 outbound purpose allowlist for offer communications
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
  'OFFER_ACCEPTANCE_CONFIRMATION'
]));

CREATE TABLE IF NOT EXISTS ops.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  current_revision_id uuid,
  status text NOT NULL CHECK (status = ANY (ARRAY[
    'DRAFT','APPROVAL_REQUIRED','APPROVED','READY','SENT','ACCEPTED','REJECTED',
    'EXPIRED','SUPERSEDED','CANCELLED','INVALIDATED'
  ])),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS offers_case_current_uniq
  ON ops.offers (case_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS offers_case_idx ON ops.offers (case_id);

CREATE TABLE IF NOT EXISTS ops.offer_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES ops.offers(id),
  revision integer NOT NULL CHECK (revision >= 1),
  is_current boolean NOT NULL DEFAULT true,
  evaluation_id uuid NOT NULL REFERENCES ops.tariff_evaluations(id),
  evaluation_fingerprint text NOT NULL,
  profile_fingerprint text NOT NULL,
  catalogue_snapshot_id uuid REFERENCES ops.tariff_catalogue_snapshots(id),
  commercial_snapshot jsonb NOT NULL,
  commercial_snapshot_hash text NOT NULL,
  fingerprint text NOT NULL,
  offer_policy_id text NOT NULL,
  offer_policy_version integer NOT NULL,
  approval_policy_id text NOT NULL,
  approval_policy_version integer NOT NULL,
  calculation_policy_version integer NOT NULL,
  ranking_policy_version integer NOT NULL,
  price_basis text NOT NULL CHECK (price_basis = ANY (ARRAY['NET','GROSS'])),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  valid_until timestamptz NOT NULL,
  state text NOT NULL CHECK (state = ANY (ARRAY[
    'DRAFT','APPROVAL_REQUIRED','APPROVED','READY','SENT','ACCEPTED','REJECTED',
    'EXPIRED','SUPERSEDED','CANCELLED','INVALIDATED'
  ])),
  source_kind text NOT NULL CHECK (source_kind = ANY (ARRAY['TEST_FIXTURE'])),
  environment_marker text NOT NULL CHECK (environment_marker = ANY (ARRAY['TEST_ONLY'])),
  customer_deliverable_live boolean NOT NULL DEFAULT false CHECK (customer_deliverable_live = false),
  synthetic boolean NOT NULL DEFAULT true,
  template_id text NOT NULL,
  template_version integer NOT NULL,
  content_hash text,
  delivery_intent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, revision),
  CHECK (jsonb_typeof(commercial_snapshot) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS offer_revisions_offer_current_uniq
  ON ops.offer_revisions (offer_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS offer_revisions_eval_idx ON ops.offer_revisions (evaluation_id);
CREATE INDEX IF NOT EXISTS offer_revisions_fingerprint_idx ON ops.offer_revisions (fingerprint);

ALTER TABLE ops.offers
  DROP CONSTRAINT IF EXISTS offers_current_revision_fk;
ALTER TABLE ops.offers
  ADD CONSTRAINT offers_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES ops.offer_revisions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS ops.offer_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_revision_id uuid NOT NULL REFERENCES ops.offer_revisions(id) ON DELETE CASCADE,
  option_index integer NOT NULL CHECK (option_index >= 1),
  tariff_version_id uuid NOT NULL REFERENCES ops.tariff_versions(id),
  rank integer,
  eligibility_status text NOT NULL CHECK (eligibility_status = ANY (ARRAY[
    'ELIGIBLE','INELIGIBLE','UNRESOLVED'
  ])),
  ongoing_annual_micro bigint,
  first_year_annual_micro bigint,
  savings_ongoing_micro bigint,
  savings_first_year_micro bigint,
  comparable boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'EUR',
  price_basis text NOT NULL CHECK (price_basis = ANY (ARRAY['NET','GROSS'])),
  supplier_name text NOT NULL,
  product_code text NOT NULL,
  energy_type text NOT NULL,
  component_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (offer_revision_id, option_index)
);

CREATE INDEX IF NOT EXISTS offer_options_revision_idx ON ops.offer_options (offer_revision_id);

CREATE TABLE IF NOT EXISTS ops.offer_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_revision_id uuid NOT NULL UNIQUE REFERENCES ops.offer_revisions(id) ON DELETE CASCADE,
  policy_version integer NOT NULL,
  decision text NOT NULL CHECK (decision = ANY (ARRAY['PENDING','APPROVED','REJECTED'])),
  actor_type text CHECK (actor_type IS NULL OR actor_type = ANY (ARRAY['SYSTEM_TEST','HUMAN'])),
  reason_code text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.offer_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_revision_id uuid NOT NULL REFERENCES ops.offer_revisions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_tokens_revision_idx ON ops.offer_tokens (offer_revision_id);

CREATE TABLE IF NOT EXISTS ops.offer_customer_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_revision_id uuid NOT NULL REFERENCES ops.offer_revisions(id),
  offer_option_id uuid REFERENCES ops.offer_options(id),
  decision text NOT NULL CHECK (decision = ANY (ARRAY['ACCEPT','REJECT'])),
  commercial_snapshot_hash text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL CHECK (channel = ANY (ARRAY['OFFER_PAGE_TOKEN'])),
  UNIQUE (offer_revision_id)
);

CREATE TABLE IF NOT EXISTS ops.switch_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  offer_id uuid NOT NULL REFERENCES ops.offers(id),
  offer_revision_id uuid NOT NULL UNIQUE REFERENCES ops.offer_revisions(id),
  commercial_snapshot_hash text NOT NULL,
  selected_tariff_version_id uuid NOT NULL REFERENCES ops.tariff_versions(id),
  catalogue_snapshot_id uuid REFERENCES ops.tariff_catalogue_snapshots(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'READY' CHECK (status = ANY (ARRAY['READY'])),
  supplier_switch_initiated boolean NOT NULL DEFAULT false CHECK (supplier_switch_initiated = false),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS switch_preparations_case_idx ON ops.switch_preparations (case_id);

COMMENT ON TABLE ops.offers IS 'A8 offer aggregate; one current offer per case';
COMMENT ON TABLE ops.offer_revisions IS 'A8 immutable commercial snapshot copied from A7; TEST_ONLY / SYNTHETIC';
COMMENT ON TABLE ops.offer_options IS 'A8 copied A7 eligible results; no pricing recomputation';
COMMENT ON TABLE ops.switch_preparations IS 'A9 handoff row only; supplier_switch_initiated stays false';
COMMENT ON COLUMN ops.offer_options.ongoing_annual_micro IS 'Copied A7 micro-EUR; not recomputed';
COMMENT ON COLUMN ops.offer_revisions.customer_deliverable_live IS 'E2 hard block: always false';

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

ALTER TABLE ops.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.offer_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.offer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.offer_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.offer_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.offer_customer_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.switch_preparations ENABLE ROW LEVEL SECURITY;

COMMIT;
