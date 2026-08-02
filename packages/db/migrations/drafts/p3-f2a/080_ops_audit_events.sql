-- DRAFT_ONLY
-- DO_NOT_APPLY
-- P3_F2B_OWNER_AUTHORIZATION_REQUIRED
-- TRANCHE=P3-F2A
-- MIGRATION_ID=p3_f2a_080_ops_audit_events
-- PURPOSE=Ops/CC audit foundation compatible with P3-F1 actor fields
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- NOTE=Does NOT alter public.audit_events (intake lead/career audit). New table name avoids collision.
-- DATA_BACKFILL_REQUIRED=NO

CREATE TABLE IF NOT EXISTS public.ops_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- P3-F1 compatible actor fields (ACTOR_TYPE / ACTOR_ID)
  actor_type text NOT NULL
    CHECK (actor_type IN (
      'PERSON_PRINCIPAL',
      'SERVICE_PRINCIPAL',
      'BREAK_GLASS_PRINCIPAL'
    )),
  actor_id text NOT NULL,
  session_id text,
  authentication_method text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  result text NOT NULL
    CHECK (result IN ('success', 'denied', 'error', 'noop')),
  source text NOT NULL DEFAULT 'ops_cc'
    CHECK (source IN ('ops_cc', 'ops_api', 'system', 'break_glass')),
  correlation_id text NOT NULL,
  -- Redacted metadata only — no secrets, no full sensitive payloads
  metadata_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_audit_events_actor_id_not_blank CHECK (length(trim(actor_id)) > 0)
);

CREATE INDEX IF NOT EXISTS ops_audit_events_created_idx
  ON public.ops_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS ops_audit_events_actor_idx
  ON public.ops_audit_events (actor_type, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ops_audit_events_target_idx
  ON public.ops_audit_events (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ops_audit_events_correlation_idx
  ON public.ops_audit_events (correlation_id);

ALTER TABLE public.ops_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ops_audit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.ops_audit_events FROM anon;
REVOKE ALL ON TABLE public.ops_audit_events FROM authenticated;

COMMENT ON TABLE public.ops_audit_events IS
  'P3-F2a DRAFT — Ops/CC audit; P3-F1 actor-compatible; separate from intake audit_events; STRONG_AUTHZ_COMPLETE=NO';
