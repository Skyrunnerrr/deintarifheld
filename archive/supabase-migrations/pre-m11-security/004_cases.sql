-- P3-F2B promoted migration
-- SOURCE_DRAFT=packages/db/migrations/drafts/p3-f2a/020_cases.sql
-- PROMOTED_AS=supabase/migrations/004_cases.sql
-- KILL_STATE_INCLUDED=NO
-- LOCAL_APPLY_ONLY=YES

-- TRANCHE=P3-F2B_PROMOTED_FROM_F2A
-- MIGRATION_ID=p3_f2a_020_cases
-- PURPOSE=First-slice cases table (Ops/CC work item root)
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none (nullable FKs reference leads/career_applications only)
-- DATA_BACKFILL_REQUIRED=NO

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_ref text NOT NULL UNIQUE,
  -- Foundation status only — not a complete business state machine
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting', 'done', 'cancelled')),
  title text NOT NULL,
  summary text,
  -- Additive references to existing intake objects (nullable; never dual-write SoT)
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
  -- Soft delete (does not replace retention / physical delete governance)
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
  )
);

CREATE INDEX IF NOT EXISTS cases_status_created_idx
  ON public.cases (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS cases_source_lead_idx
  ON public.cases (source_lead_id)
  WHERE source_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cases_source_career_idx
  ON public.cases (source_career_application_id)
  WHERE source_career_application_id IS NOT NULL;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Default-deny posture: no permissive policies; no public/browser grants.
REVOKE ALL ON TABLE public.cases FROM PUBLIC;
REVOKE ALL ON TABLE public.cases FROM anon;
REVOKE ALL ON TABLE public.cases FROM authenticated;

COMMENT ON TABLE public.cases IS
  'P3-F2a DRAFT — DTH Ops/CC cases; browser direct access not granted; STRONG_AUTHZ_COMPLETE=NO';
