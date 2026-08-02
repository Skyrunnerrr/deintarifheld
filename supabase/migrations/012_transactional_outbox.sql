-- P3-F2B promoted migration
-- SOURCE_DRAFT=packages/db/migrations/drafts/p3-f2a/100_transactional_outbox.sql
-- PROMOTED_AS=supabase/migrations/012_transactional_outbox.sql
-- KILL_STATE_INCLUDED=NO
-- LOCAL_APPLY_ONLY=YES

-- TRANCHE=P3-F2B_PROMOTED_FROM_F2A
-- MIGRATION_ID=p3_f2a_100_transactional_outbox
-- PURPOSE=Transactional outbox foundation (no worker, no dispatch, no external integration)
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO
-- AUTOMATION_ACTIVATION=NO

CREATE TABLE IF NOT EXISTS public.transactional_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  -- Prefer payload_ref when large; payload_redacted is minimized only
  payload_ref text,
  payload_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error_class text,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactional_outbox_idempotency_key_unique UNIQUE (idempotency_key),
  CONSTRAINT transactional_outbox_payload_presence CHECK (
    payload_ref IS NOT NULL OR payload_redacted IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS transactional_outbox_status_available_idx
  ON public.transactional_outbox (status, available_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS transactional_outbox_aggregate_idx
  ON public.transactional_outbox (aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS transactional_outbox_correlation_idx
  ON public.transactional_outbox (correlation_id);

ALTER TABLE public.transactional_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.transactional_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.transactional_outbox FROM anon;
REVOKE ALL ON TABLE public.transactional_outbox FROM authenticated;

COMMENT ON TABLE public.transactional_outbox IS
  'P3-F2a DRAFT — transactional outbox foundation; NO worker/dispatch; AUTOMATION_ACTIVATION=NO; STRONG_AUTHZ_COMPLETE=NO';
