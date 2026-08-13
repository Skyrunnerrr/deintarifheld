-- P3-F2B promoted migration
-- SOURCE_DRAFT=packages/db/migrations/drafts/p3-f2a/040_tasks_and_reminders.sql
-- PROMOTED_AS=supabase/migrations/006_tasks_and_reminders.sql
-- KILL_STATE_INCLUDED=NO
-- LOCAL_APPLY_ONLY=YES

-- TRANCHE=P3-F2B_PROMOTED_FROM_F2A
-- MIGRATION_ID=p3_f2a_040_tasks_and_reminders
-- PURPOSE=Tasks and Wiedervorlagen (reminders) for first-slice Ops/CC
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting', 'done', 'cancelled')),
  due_at timestamptz,
  assigned_person_id text,
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
  CONSTRAINT tasks_person_creator_consistency CHECK (
    created_by_person_id IS NULL
    OR created_by_actor_type = 'PERSON_PRINCIPAL'
  )
);

CREATE INDEX IF NOT EXISTS tasks_case_status_idx
  ON public.tasks (case_id, status, due_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_assigned_person_idx
  ON public.tasks (assigned_person_id)
  WHERE assigned_person_id IS NOT NULL AND deleted_at IS NULL;

-- Wiedervorlagen / reminders (foundation; no automation dispatch)
CREATE TABLE IF NOT EXISTS public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE RESTRICT,
  remind_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'acknowledged', 'cancelled')),
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
  deletion_reason text
);

CREATE INDEX IF NOT EXISTS task_reminders_remind_at_idx
  ON public.task_reminders (remind_at, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tasks FROM PUBLIC;
REVOKE ALL ON TABLE public.tasks FROM anon;
REVOKE ALL ON TABLE public.tasks FROM authenticated;
REVOKE ALL ON TABLE public.task_reminders FROM PUBLIC;
REVOKE ALL ON TABLE public.task_reminders FROM anon;
REVOKE ALL ON TABLE public.task_reminders FROM authenticated;

COMMENT ON TABLE public.tasks IS
  'P3-F2a DRAFT — Ops/CC tasks; no worker activation; STRONG_AUTHZ_COMPLETE=NO';
COMMENT ON TABLE public.task_reminders IS
  'P3-F2a DRAFT — Wiedervorlagen foundation; no automation dispatch; STRONG_AUTHZ_COMPLETE=NO';
