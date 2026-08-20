-- DTH-A12 Content Autopilot (local additive, ops private)
-- AI output is candidate only. No live social/AI. No 9th KillDomain.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ops.content_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL,
  audience text NOT NULL,
  topic text NOT NULL,
  angle text NOT NULL DEFAULT '',
  primary_message text NOT NULL,
  supporting_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta text NOT NULL,
  channel text NOT NULL,
  format text NOT NULL DEFAULT 'SHORT_POST',
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_hint text,
  strategy_policy_id text NOT NULL,
  strategy_policy_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES ops.content_briefs(id),
  channel text NOT NULL,
  status text NOT NULL,
  risk_class text NOT NULL,
  current_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES ops.content_items(id),
  revision_no integer NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  fingerprint text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  headline text NOT NULL,
  body_text text NOT NULL,
  cta text NOT NULL,
  hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generator_id text NOT NULL,
  generator_mode text NOT NULL,
  brand_policy_version integer NOT NULL,
  risk_policy_version integer NOT NULL,
  approval_policy_version integer NOT NULL,
  risk_class text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_item_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS content_revisions_one_current
  ON ops.content_revisions (content_item_id) WHERE is_current;

ALTER TABLE ops.content_items
  DROP CONSTRAINT IF EXISTS content_items_current_revision_fk;
ALTER TABLE ops.content_items
  ADD CONSTRAINT content_items_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES ops.content_revisions(id);

CREATE TABLE IF NOT EXISTS ops.content_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_revision_id uuid NOT NULL REFERENCES ops.content_revisions(id),
  claim_type text NOT NULL,
  claim_text text NOT NULL,
  claim_state text NOT NULL,
  pattern_id text,
  source_ref text,
  risk_class text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.content_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_revision_id uuid NOT NULL UNIQUE REFERENCES ops.content_revisions(id),
  content_hash text NOT NULL,
  policy_id text NOT NULL,
  policy_version integer NOT NULL,
  decision text NOT NULL,
  actor_type text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.content_publication_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_revision_id uuid NOT NULL REFERENCES ops.content_revisions(id),
  content_item_id uuid NOT NULL REFERENCES ops.content_items(id),
  channel text NOT NULL,
  content_hash text NOT NULL,
  provider_code text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.content_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL UNIQUE REFERENCES ops.content_publication_intents(id),
  content_revision_id uuid NOT NULL REFERENCES ops.content_revisions(id),
  content_item_id uuid NOT NULL REFERENCES ops.content_items(id),
  channel text NOT NULL,
  provider_code text NOT NULL,
  provider_post_id text,
  state text NOT NULL,
  published_at timestamptz,
  readback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.content_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES ops.content_publications(id),
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  engagement integer NOT NULL DEFAULT 0,
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_items_status_idx ON ops.content_items (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS content_intents_due_idx
  ON ops.content_publication_intents (state, scheduled_at);
CREATE INDEX IF NOT EXISTS content_metrics_pub_idx
  ON ops.content_metric_snapshots (publication_id, captured_at DESC);

COMMENT ON TABLE ops.content_briefs IS 'A12 structured briefs. Not prompt authority.';
COMMENT ON TABLE ops.content_revisions IS 'Immutable content revisions. Fingerprint unique.';
COMMENT ON TABLE ops.content_publication_intents IS 'Durable publication intent before provider call.';
COMMENT ON TABLE ops.content_metric_snapshots IS 'Append-only provider metrics. Not revenue attribution.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

ALTER TABLE ops.content_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.content_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.content_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.content_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.content_publication_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.content_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.content_metric_snapshots ENABLE ROW LEVEL SECURITY;

COMMIT;
