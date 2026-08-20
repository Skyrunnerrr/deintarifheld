-- DTH-A13 Acquisition Autopilot (local additive, ops private)
-- No live ads. Money as bigint micro-EUR. Kill via AUTOMATION_ENGINE.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ops.acquisition_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objective text NOT NULL,
  source_kind text NOT NULL,
  status text NOT NULL,
  current_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.acquisition_campaign_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ops.acquisition_campaigns(id),
  revision_no integer NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  fingerprint text NOT NULL UNIQUE,
  budget_hash text NOT NULL,
  destination text NOT NULL,
  cta text NOT NULL,
  channel text NOT NULL DEFAULT 'SYNTHETIC',
  source_kind text NOT NULL,
  content_revision_id uuid,
  content_publication_id uuid,
  content_hash text,
  total_budget_micro_eur bigint NOT NULL DEFAULT 0 CHECK (total_budget_micro_eur >= 0),
  daily_budget_micro_eur bigint NOT NULL DEFAULT 0 CHECK (daily_budget_micro_eur >= 0),
  provider_code text NOT NULL DEFAULT 'DeterministicTestAcquisitionProvider',
  provider_account_ref text NOT NULL DEFAULT 'synth_ad_account_e2_local_001',
  attribution_policy_id text NOT NULL,
  attribution_policy_version integer NOT NULL,
  budget_policy_id text NOT NULL,
  budget_policy_version integer NOT NULL,
  schedule_start timestamptz,
  schedule_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS acquisition_revisions_one_current
  ON ops.acquisition_campaign_revisions (campaign_id) WHERE is_current;

ALTER TABLE ops.acquisition_campaigns
  DROP CONSTRAINT IF EXISTS acquisition_campaigns_current_revision_fk;
ALTER TABLE ops.acquisition_campaigns
  ADD CONSTRAINT acquisition_campaigns_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES ops.acquisition_campaign_revisions(id);

CREATE TABLE IF NOT EXISTS ops.acquisition_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acq_ref text NOT NULL UNIQUE,
  campaign_id uuid NOT NULL REFERENCES ops.acquisition_campaigns(id),
  campaign_revision_id uuid NOT NULL REFERENCES ops.acquisition_campaign_revisions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.acquisition_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acq_ref text,
  campaign_id uuid,
  campaign_revision_id uuid,
  touchpoint_type text NOT NULL,
  lead_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.lead_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE,
  campaign_id uuid,
  campaign_revision_id uuid,
  acq_ref text,
  touchpoint_id uuid,
  attribution_state text NOT NULL,
  policy_id text NOT NULL,
  policy_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.campaign_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_revision_id uuid NOT NULL UNIQUE REFERENCES ops.acquisition_campaign_revisions(id),
  budget_hash text NOT NULL,
  destination text NOT NULL,
  content_hash text,
  policy_id text NOT NULL,
  policy_version integer NOT NULL,
  decision text NOT NULL,
  actor_type text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.acquisition_provider_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ops.acquisition_campaigns(id),
  campaign_revision_id uuid NOT NULL REFERENCES ops.acquisition_campaign_revisions(id),
  intent_kind text NOT NULL,
  provider_code text NOT NULL,
  provider_account_ref text NOT NULL,
  budget_hash text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL,
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.acquisition_provider_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  create_intent_id uuid UNIQUE REFERENCES ops.acquisition_provider_intents(id),
  activate_intent_id uuid REFERENCES ops.acquisition_provider_intents(id),
  campaign_id uuid NOT NULL REFERENCES ops.acquisition_campaigns(id),
  campaign_revision_id uuid NOT NULL REFERENCES ops.acquisition_campaign_revisions(id),
  provider_code text NOT NULL,
  provider_campaign_id text,
  provider_account_ref text NOT NULL,
  state text NOT NULL,
  spend_micro_eur bigint NOT NULL DEFAULT 0 CHECK (spend_micro_eur >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS acquisition_provider_campaigns_provider_uidx
  ON ops.acquisition_provider_campaigns (provider_code, provider_campaign_id)
  WHERE provider_campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ops.acquisition_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ops.acquisition_campaigns(id),
  campaign_revision_id uuid NOT NULL REFERENCES ops.acquisition_campaign_revisions(id),
  provider_campaign_row_id uuid REFERENCES ops.acquisition_provider_campaigns(id),
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  landing_visits integer NOT NULL DEFAULT 0,
  form_starts integer NOT NULL DEFAULT 0,
  leads_accepted integer NOT NULL DEFAULT 0,
  spend_micro_eur bigint NOT NULL DEFAULT 0 CHECK (spend_micro_eur >= 0),
  cpl_micro_eur bigint,
  roas text NOT NULL DEFAULT 'UNKNOWN',
  revenue_micro_eur bigint,
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acquisition_campaigns_status_idx
  ON ops.acquisition_campaigns (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS acquisition_touchpoints_ref_idx
  ON ops.acquisition_touchpoints (acq_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS acquisition_intents_state_idx
  ON ops.acquisition_provider_intents (state, intent_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS acquisition_metrics_campaign_idx
  ON ops.acquisition_metric_snapshots (campaign_id, captured_at DESC);

COMMENT ON TABLE ops.acquisition_refs IS 'Opaque non-PII acq_ref. Not fingerprinting.';
COMMENT ON TABLE ops.lead_attributions IS 'Primary attribution decision separate from raw touchpoints.';
COMMENT ON TABLE ops.acquisition_provider_intents IS 'Durable intent before provider call. create≠active.';
COMMENT ON TABLE ops.acquisition_metric_snapshots IS 'CPL only with exact spend+leads; ROAS UNKNOWN without revenue.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

ALTER TABLE ops.acquisition_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.acquisition_campaign_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.acquisition_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.acquisition_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.lead_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.campaign_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.acquisition_provider_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.acquisition_provider_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.acquisition_metric_snapshots ENABLE ROW LEVEL SECURITY;

COMMIT;
