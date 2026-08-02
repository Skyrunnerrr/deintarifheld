-- DRAFT_ONLY
-- DO_NOT_APPLY
-- P3_F2B_OWNER_AUTHORIZATION_REQUIRED
-- TRANCHE=P3-F2A
-- MIGRATION_ID=p3_f2a_070_communication_events
-- PURPOSE=Communication events SoT store (store SoT IDs only; aliases never create types)
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO
-- NOTE=No mail send / customer confirmation / marketing execution in this draft

CREATE TABLE IF NOT EXISTS public.communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases (id) ON DELETE SET NULL,
  -- SoT IDs only (J-F-01). Aliases CONTACT_ATTEMPT / INTERNAL_NOTE_CREATED must not appear.
  sot_event_type text NOT NULL
    CHECK (sot_event_type IN (
      'OUTBOUND_CONTACT_ATTEMPT',
      'INBOUND_MESSAGE_RECORDED',
      'INTERNAL_OPS_MESSAGE_RECORDED'
    )),
  channel text
    CHECK (
      channel IS NULL
      OR channel IN ('phone', 'email', 'other_ops')
    ),
  direction text
    CHECK (
      direction IS NULL
      OR direction IN ('outbound', 'inbound', 'internal')
    ),
  -- Redacted / minimized metadata only — never full sensitive payloads or secrets
  metadata_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  CONSTRAINT communication_events_person_creator_consistency CHECK (
    created_by_person_id IS NULL
    OR created_by_actor_type = 'PERSON_PRINCIPAL'
  )
);

CREATE INDEX IF NOT EXISTS communication_events_case_created_idx
  ON public.communication_events (case_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS communication_events_sot_type_idx
  ON public.communication_events (sot_event_type, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.communication_events FROM PUBLIC;
REVOKE ALL ON TABLE public.communication_events FROM anon;
REVOKE ALL ON TABLE public.communication_events FROM authenticated;

COMMENT ON TABLE public.communication_events IS
  'P3-F2a DRAFT — comms SoT events; FIRST_RESPONSE=milestone only; no send execution; STRONG_AUTHZ_COMPLETE=NO';
