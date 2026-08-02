-- P3-F2B promoted migration
-- SOURCE_DRAFT=packages/db/migrations/drafts/p3-f2a/030_case_notes.sql
-- PROMOTED_AS=supabase/migrations/005_case_notes.sql
-- KILL_STATE_INCLUDED=NO
-- LOCAL_APPLY_ONLY=YES

-- TRANCHE=P3-F2B_PROMOTED_FROM_F2A
-- MIGRATION_ID=p3_f2a_030_case_notes
-- PURPOSE=Internal working notes on cases (SoT: CASE_NOTE_RECORDED — not alias tables)
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO

CREATE TABLE IF NOT EXISTS public.case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE RESTRICT,
  body text NOT NULL,
  -- SoT event id for note recording (architecture lexicon; not a dual entity)
  sot_event_type text NOT NULL DEFAULT 'CASE_NOTE_RECORDED'
    CHECK (sot_event_type = 'CASE_NOTE_RECORDED'),
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
  CONSTRAINT case_notes_person_creator_consistency CHECK (
    created_by_person_id IS NULL
    OR created_by_actor_type = 'PERSON_PRINCIPAL'
  )
);

CREATE INDEX IF NOT EXISTS case_notes_case_created_idx
  ON public.case_notes (case_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.case_notes FROM PUBLIC;
REVOKE ALL ON TABLE public.case_notes FROM anon;
REVOKE ALL ON TABLE public.case_notes FROM authenticated;

COMMENT ON TABLE public.case_notes IS
  'P3-F2a DRAFT — case notes; FIRST_RESPONSE is a milestone not a note entity; STRONG_AUTHZ_COMPLETE=NO';
