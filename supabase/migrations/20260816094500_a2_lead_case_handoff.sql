-- DTH-A2 Lead → Case Autopilot
-- AUTHORIZED_ENVIRONMENT=LOCAL_TEST_ONLY (do not apply to production)
-- Consumes M11T (source outbox + Public→Ops handoff).
-- Promotes cases + transactional_outbox into canonical apply root (additive).
-- Does NOT retire service_role (M11S) or cut over production intake (M11Q).

BEGIN;

-- ─── Ops cases (from P3-F2a draft; additive unique source_lead) ───────────────

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_ref text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting', 'done', 'cancelled')),
  title text NOT NULL,
  summary text,
  source_lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  source_career_application_id uuid REFERENCES public.career_applications (id) ON DELETE SET NULL,
  created_by_person_id text,
  created_by_actor_type text
    CHECK (
      created_by_actor_type IS NULL
      OR created_by_actor_type IN (
        'PERSON_PRINCIPAL',
        'SERVICE_PRINCIPAL',
        'BREAK_GLASS_PRINCIPAL'
      )
    ),
  created_by_actor_id text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_actor_type text
    CHECK (
      deleted_by_actor_type IS NULL
      OR deleted_by_actor_type IN (
        'PERSON_PRINCIPAL',
        'SERVICE_PRINCIPAL',
        'BREAK_GLASS_PRINCIPAL'
      )
    ),
  deleted_by_actor_id text,
  deletion_reason text,
  CONSTRAINT cases_person_creator_consistency CHECK (
    created_by_person_id IS NULL
    OR created_by_actor_type = 'PERSON_PRINCIPAL'
  ),
  CONSTRAINT cases_not_both_sources CHECK (
    NOT (
      source_lead_id IS NOT NULL
      AND source_career_application_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS cases_status_created_idx
  ON public.cases (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS cases_source_lead_idx
  ON public.cases (source_lead_id)
  WHERE source_lead_id IS NOT NULL;

-- A2 invariant: at most one active Ops Case per source Lead
CREATE UNIQUE INDEX IF NOT EXISTS cases_one_active_source_lead_uidx
  ON public.cases (source_lead_id)
  WHERE source_lead_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cases FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.cases FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.cases FROM authenticated';
  END IF;
END $$;

COMMENT ON TABLE public.cases IS
  'DTH-A2 Ops cases; one active Case per source Lead; browser direct access not granted';

-- ─── Transactional outbox (source event handoff) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.transactional_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
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
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.transactional_outbox FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.transactional_outbox FROM authenticated';
  END IF;
END $$;

COMMENT ON TABLE public.transactional_outbox IS
  'DTH-A2 source outbox; BUSINESS_LEAD_ACCEPTED handoff; AUTOMATION via workers; no browser access';

COMMIT;
