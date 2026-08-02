-- P3-F2B promoted migration
-- SOURCE_DRAFT=packages/db/migrations/drafts/p3-f2a/060_status_history.sql
-- PROMOTED_AS=supabase/migrations/008_status_history.sql
-- KILL_STATE_INCLUDED=NO
-- LOCAL_APPLY_ONLY=YES

-- TRANCHE=P3-F2B_PROMOTED_FROM_F2A
-- MIGRATION_ID=p3_f2a_060_status_history
-- PURPOSE=Append-oriented status history for cases/tasks (foundation statuses only)
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO
-- NOTE=Append-only foundation; no soft-delete (history rows are not erased by soft-delete)

CREATE TABLE IF NOT EXISTS public.status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL
    CHECK (target_type IN ('case', 'task')),
  target_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL
    CHECK (to_status IN ('open', 'in_progress', 'waiting', 'done', 'cancelled')),
  changed_by_person_id text,
  changed_by_actor_type text
    CHECK (
      changed_by_actor_type IS NULL
      OR changed_by_actor_type IN (
        'PERSON_PRINCIPAL',
        'SERVICE_PRINCIPAL',
        'BREAK_GLASS_PRINCIPAL'
      )
    ),
  changed_by_actor_id text,
  reason text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_history_person_changer_consistency CHECK (
    changed_by_person_id IS NULL
    OR changed_by_actor_type = 'PERSON_PRINCIPAL'
  )
);

CREATE INDEX IF NOT EXISTS status_history_target_created_idx
  ON public.status_history (target_type, target_id, created_at DESC);

ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.status_history FROM PUBLIC;
REVOKE ALL ON TABLE public.status_history FROM anon;
REVOKE ALL ON TABLE public.status_history FROM authenticated;

COMMENT ON TABLE public.status_history IS
  'P3-F2a DRAFT — append-oriented status history; foundation statuses only; STRONG_AUTHZ_COMPLETE=NO';
