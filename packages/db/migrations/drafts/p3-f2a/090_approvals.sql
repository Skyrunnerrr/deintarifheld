-- DRAFT_ONLY
-- DO_NOT_APPLY
-- P3_F2B_OWNER_AUTHORIZATION_REQUIRED
-- TRANCHE=P3-F2A
-- MIGRATION_ID=p3_f2a_090_approvals
-- PURPOSE=Approval request/decision foundation (no automatic four-eyes activation)
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requester_person_id text,
  requester_actor_type text
    CHECK (
      requester_actor_type IS NULL
      OR requester_actor_type IN (
        'PERSON_PRINCIPAL',
        'SERVICE_PRINCIPAL',
        'BREAK_GLASS_PRINCIPAL'
      )
    ),
  requester_actor_id text,
  reason text,
  correlation_id text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_requests_person_requester_consistency CHECK (
    requester_person_id IS NULL
    OR requester_actor_type = 'PERSON_PRINCIPAL'
  )
);

CREATE TABLE IF NOT EXISTS public.approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES public.approval_requests (id) ON DELETE RESTRICT,
  decision text NOT NULL
    CHECK (decision IN ('approved', 'rejected')),
  decided_by_person_id text,
  decided_by_actor_type text
    CHECK (
      decided_by_actor_type IS NULL
      OR decided_by_actor_type IN (
        'PERSON_PRINCIPAL',
        'SERVICE_PRINCIPAL',
        'BREAK_GLASS_PRINCIPAL'
      )
    ),
  decided_by_actor_id text,
  reason text,
  correlation_id text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_decisions_person_decider_consistency CHECK (
    decided_by_person_id IS NULL
    OR decided_by_actor_type = 'PERSON_PRINCIPAL'
  )
);

CREATE INDEX IF NOT EXISTS approval_requests_status_requested_idx
  ON public.approval_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS approval_decisions_request_idx
  ON public.approval_decisions (approval_request_id, decided_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.approval_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.approval_requests FROM anon;
REVOKE ALL ON TABLE public.approval_requests FROM authenticated;
REVOKE ALL ON TABLE public.approval_decisions FROM PUBLIC;
REVOKE ALL ON TABLE public.approval_decisions FROM anon;
REVOKE ALL ON TABLE public.approval_decisions FROM authenticated;

COMMENT ON TABLE public.approval_requests IS
  'P3-F2a DRAFT — approval requests foundation; four-eyes not auto-activated; STRONG_AUTHZ_COMPLETE=NO';
COMMENT ON TABLE public.approval_decisions IS
  'P3-F2a DRAFT — approval decisions foundation; STRONG_AUTHZ_COMPLETE=NO';
