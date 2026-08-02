-- DRAFT_ONLY
-- DO_NOT_APPLY
-- P3_F2B_OWNER_AUTHORIZATION_REQUIRED
-- TRANCHE=P3-F2A
-- MIGRATION_ID=p3_f2a_050_assignments
-- PURPOSE=Ownership / assignment history for cases (person principals only as assignees)
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO

CREATE TABLE IF NOT EXISTS public.case_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE RESTRICT,
  assigned_person_id text NOT NULL,
  assigned_by_person_id text,
  assigned_by_actor_type text
    CHECK (
      assigned_by_actor_type IS NULL
      OR assigned_by_actor_type IN (
        'PERSON_PRINCIPAL',
        'SERVICE_PRINCIPAL',
        'BREAK_GLASS_PRINCIPAL'
      )
    ),
  assigned_by_actor_id text,
  reason text,
  correlation_id text,
  effective_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
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
  CONSTRAINT case_assignments_person_assignee_not_blank CHECK (
    length(trim(assigned_person_id)) > 0
  )
);

CREATE INDEX IF NOT EXISTS case_assignments_case_effective_idx
  ON public.case_assignments (case_id, effective_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS case_assignments_person_idx
  ON public.case_assignments (assigned_person_id)
  WHERE deleted_at IS NULL AND ended_at IS NULL;

ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.case_assignments FROM PUBLIC;
REVOKE ALL ON TABLE public.case_assignments FROM anon;
REVOKE ALL ON TABLE public.case_assignments FROM authenticated;

COMMENT ON TABLE public.case_assignments IS
  'P3-F2a DRAFT — case ownership/assignments; assignee is person id only; STRONG_AUTHZ_COMPLETE=NO';
