-- DTH-A7 Energy + Tariff Domain (local additive, ops private)
-- No live tariff source / AI / scraping. No staging/production apply.
-- Domain kill: KillDomain.AUTOMATION_ENGINE (no 9th KillDomain).

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ops.tariff_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status = ANY (ARRAY[
    'ACTIVE','INACTIVE','DRAFT','SUPERSEDED'
  ])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.tariff_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES ops.tariff_suppliers(id),
  product_code text NOT NULL,
  energy_type text NOT NULL CHECK (energy_type = ANY (ARRAY['ELECTRICITY','GAS'])),
  customer_segment text NOT NULL CHECK (customer_segment = ANY (ARRAY['BUSINESS','PRIVATE'])),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status = ANY (ARRAY[
    'ACTIVE','INACTIVE','DRAFT','SUPERSEDED'
  ])),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, product_code)
);

CREATE INDEX IF NOT EXISTS tariff_products_energy_idx ON ops.tariff_products (energy_type, customer_segment);

CREATE TABLE IF NOT EXISTS ops.tariff_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES ops.tariff_products(id),
  version text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status = ANY (ARRAY[
    'ACTIVE','INACTIVE','DRAFT','SUPERSEDED'
  ])),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  price_basis text NOT NULL CHECK (price_basis = ANY (ARRAY['NET','GROSS'])),
  source_kind text NOT NULL CHECK (source_kind = ANY (ARRAY['TEST_FIXTURE'])),
  source_ref text NOT NULL,
  source_hash text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS tariff_versions_validity_idx
  ON ops.tariff_versions (status, valid_from, valid_to);

CREATE TABLE IF NOT EXISTS ops.tariff_price_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_version_id uuid NOT NULL REFERENCES ops.tariff_versions(id) ON DELETE CASCADE,
  component_type text NOT NULL CHECK (component_type = ANY (ARRAY[
    'ENERGY_VARIABLE','BASE_FIXED','METER_FIXED','SITE_FIXED',
    'BONUS','DISCOUNT','SURCHARGE','TAX_COMPONENT','OTHER_FIXED','OTHER_VARIABLE'
  ])),
  unit text NOT NULL,
  rate_micro bigint NOT NULL,
  frequency text NOT NULL CHECK (frequency = ANY (ARRAY[
    'PER_YEAR','PER_MONTH','PER_DAY','ONE_TIME','PER_KWH'
  ])),
  per_supply_point boolean NOT NULL DEFAULT false,
  applies_to text NOT NULL CHECK (applies_to = ANY (ARRAY['first_year','ongoing','both'])),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tariff_price_components_version_idx
  ON ops.tariff_price_components (tariff_version_id, sort_order);

CREATE TABLE IF NOT EXISTS ops.tariff_eligibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_version_id uuid NOT NULL REFERENCES ops.tariff_versions(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type = ANY (ARRAY[
    'ENERGY_TYPE','CUSTOMER_SEGMENT','CONSUMPTION_MIN_KWH','CONSUMPTION_MAX_KWH',
    'POSTCODE_ALLOWLIST','POSTCODE_PREFIX_ALLOWLIST','METERING_TYPE_REQUIRED',
    'SUPPLY_POINT_MIN','SUPPLY_POINT_MAX'
  ])),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(params) = 'object'),
  CHECK (octet_length(params::text) <= 4096)
);

CREATE INDEX IF NOT EXISTS tariff_eligibility_rules_version_idx
  ON ops.tariff_eligibility_rules (tariff_version_id);

CREATE TABLE IF NOT EXISTS ops.tariff_catalogue_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS ops.tariff_catalogue_snapshot_members (
  snapshot_id uuid NOT NULL REFERENCES ops.tariff_catalogue_snapshots(id) ON DELETE CASCADE,
  tariff_version_id uuid NOT NULL REFERENCES ops.tariff_versions(id),
  PRIMARY KEY (snapshot_id, tariff_version_id)
);

CREATE TABLE IF NOT EXISTS ops.energy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  revision integer NOT NULL CHECK (revision >= 1),
  fingerprint text NOT NULL,
  energy_type text CHECK (energy_type IS NULL OR energy_type = ANY (ARRAY['ELECTRICITY','GAS'])),
  annual_consumption_kwh bigint,
  supply_point_count integer NOT NULL DEFAULT 1 CHECK (supply_point_count >= 1),
  postcode text,
  metering_type text,
  current_supplier text,
  baseline_annual_micro bigint,
  baseline_basis text CHECK (baseline_basis IS NULL OR baseline_basis = ANY (ARRAY['NET','GROSS'])),
  baseline_currency text CHECK (baseline_currency IS NULL OR baseline_currency ~ '^[A-Z]{3}$'),
  baseline_source text NOT NULL DEFAULT 'NONE' CHECK (baseline_source = ANY (ARRAY[
    'DOCUMENT_FACT','LEAD_PAYLOAD','NONE'
  ])),
  readiness text NOT NULL CHECK (readiness = ANY (ARRAY[
    'READY','PARTIAL','CONFLICT_REVIEW_REQUIRED','INPUT_REQUIRED','HUMAN_REVIEW'
  ])),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, revision),
  UNIQUE (fingerprint)
);

CREATE UNIQUE INDEX IF NOT EXISTS energy_profiles_case_current_uniq
  ON ops.energy_profiles (case_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS energy_profiles_case_idx ON ops.energy_profiles (case_id);

CREATE TABLE IF NOT EXISTS ops.tariff_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  profile_id uuid NOT NULL REFERENCES ops.energy_profiles(id),
  catalogue_snapshot_id uuid REFERENCES ops.tariff_catalogue_snapshots(id),
  calculation_policy_version integer NOT NULL,
  ranking_policy_version integer NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['COMPLETED','BLOCKED','FAILED'])),
  readiness text NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  fingerprint text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint)
);

CREATE UNIQUE INDEX IF NOT EXISTS tariff_evaluations_case_current_uniq
  ON ops.tariff_evaluations (case_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS tariff_evaluations_case_idx ON ops.tariff_evaluations (case_id);

CREATE TABLE IF NOT EXISTS ops.tariff_evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES ops.tariff_evaluations(id) ON DELETE CASCADE,
  tariff_version_id uuid NOT NULL REFERENCES ops.tariff_versions(id),
  eligibility_status text NOT NULL CHECK (eligibility_status = ANY (ARRAY[
    'ELIGIBLE','INELIGIBLE','UNRESOLVED'
  ])),
  reason_codes text[] NOT NULL DEFAULT '{}',
  ongoing_annual_micro bigint,
  first_year_annual_micro bigint,
  savings_ongoing_micro bigint,
  savings_first_year_micro bigint,
  rank integer,
  component_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  comparable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, tariff_version_id)
);

CREATE INDEX IF NOT EXISTS tariff_evaluation_results_eval_idx
  ON ops.tariff_evaluation_results (evaluation_id, rank);

COMMENT ON TABLE ops.tariff_suppliers IS 'A7 synthetic/test tariff suppliers; no live market feed';
COMMENT ON TABLE ops.tariff_versions IS 'A7 immutable tariff versions with TEST_FIXTURE provenance';
COMMENT ON TABLE ops.tariff_eligibility_rules IS 'A7 bounded rule_type+params; NEVER executable code';
COMMENT ON TABLE ops.energy_profiles IS 'A7 case energy profile from A6 evidence + lead baseline';
COMMENT ON TABLE ops.tariff_evaluations IS 'A7 evaluation snapshot; current uniqueness per case';
COMMENT ON COLUMN ops.tariff_price_components.rate_micro IS 'micro-EUR absolute or microEUR/kWh for ENERGY_VARIABLE';

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

ALTER TABLE ops.tariff_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_price_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_catalogue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_catalogue_snapshot_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.energy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tariff_evaluation_results ENABLE ROW LEVEL SECURITY;

COMMIT;
