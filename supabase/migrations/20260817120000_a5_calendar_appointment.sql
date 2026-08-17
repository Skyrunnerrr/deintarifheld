-- DTH-A5 Calendar + Appointment Agent (local additive, ops private)
-- Provider-neutral. No live calendar credentials. No staging/production apply.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

-- Extend A4 outbound purpose allowlist for appointment communications
ALTER TABLE ops.outbound_intents DROP CONSTRAINT IF EXISTS outbound_intents_purpose_check;
ALTER TABLE ops.outbound_intents ADD CONSTRAINT outbound_intents_purpose_check CHECK (purpose = ANY (ARRAY[
  'MISSING_INFORMATION_REQUEST',
  'MISSING_INFORMATION_FOLLOWUP',
  'APPOINTMENT_OFFER',
  'APPOINTMENT_CONFIRMATION',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_RESCHEDULE_CONFIRMATION',
  'APPOINTMENT_CANCELLATION_CONFIRMATION'
]));

CREATE TABLE IF NOT EXISTS ops.booking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  workflow_instance_id uuid REFERENCES workflow.workflow_instances(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'INITIAL_B2B_CONSULTATION'
    CHECK (purpose = 'INITIAL_B2B_CONSULTATION'),
  status text NOT NULL DEFAULT 'PREPARING' CHECK (status = ANY (ARRAY[
    'PREPARING','OPEN','BOOKING_IN_PROGRESS','BOOKED','EXPIRED','SUPERSEDED','CANCELLED','EXCEPTION'
  ])),
  booking_ref text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  token_version integer NOT NULL DEFAULT 1,
  eligibility_fingerprint text NOT NULL,
  appointment_policy_version integer NOT NULL DEFAULT 1,
  calendar_resource_id text NOT NULL DEFAULT 'dth_default_resource',
  slot_generation integer NOT NULL DEFAULT 1 CHECK (slot_generation >= 1),
  expires_at timestamptz NOT NULL,
  selected_slot_id uuid,
  appointment_id uuid,
  confirmation_intent_id uuid,
  offer_intent_id uuid,
  exception_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_sessions_case_idx ON ops.booking_sessions (case_id);
CREATE INDEX IF NOT EXISTS booking_sessions_status_idx ON ops.booking_sessions (status);

-- At most one OPEN/BOOKING_IN_PROGRESS session per case+purpose
CREATE UNIQUE INDEX IF NOT EXISTS booking_sessions_one_active_per_case
  ON ops.booking_sessions (case_id, purpose)
  WHERE status IN ('PREPARING','OPEN','BOOKING_IN_PROGRESS');

CREATE TABLE IF NOT EXISTS ops.booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_session_id uuid NOT NULL REFERENCES ops.booking_sessions(id) ON DELETE CASCADE,
  generation integer NOT NULL CHECK (generation >= 1),
  start_at_utc timestamptz NOT NULL,
  end_at_utc timestamptz NOT NULL,
  timezone text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_at_utc < end_at_utc),
  UNIQUE (booking_session_id, generation, start_at_utc, end_at_utc)
);

CREATE INDEX IF NOT EXISTS booking_slots_session_gen_idx
  ON ops.booking_slots (booking_session_id, generation);

ALTER TABLE ops.booking_sessions
  DROP CONSTRAINT IF EXISTS booking_sessions_selected_slot_id_fkey;
ALTER TABLE ops.booking_sessions
  ADD CONSTRAINT booking_sessions_selected_slot_id_fkey
  FOREIGN KEY (selected_slot_id) REFERENCES ops.booking_slots(id);

CREATE TABLE IF NOT EXISTS ops.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  booking_session_id uuid NOT NULL REFERENCES ops.booking_sessions(id),
  purpose text NOT NULL DEFAULT 'INITIAL_B2B_CONSULTATION'
    CHECK (purpose = 'INITIAL_B2B_CONSULTATION'),
  calendar_resource_id text NOT NULL DEFAULT 'dth_default_resource',
  provider text NOT NULL DEFAULT 'test_calendar',
  provider_event_id text,
  dth_idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING_PROVIDER' CHECK (status = ANY (ARRAY[
    'PENDING_PROVIDER','OUTCOME_UNKNOWN','CONFIRMED','CONFIRMED_MEETING_LINK_PENDING',
    'CANCEL_PENDING','CANCELLED','RESCHEDULE_PENDING','SUPERSEDED',
    'RECONCILIATION_REQUIRED','FAILED'
  ])),
  start_at_utc timestamptz NOT NULL,
  end_at_utc timestamptz NOT NULL,
  timezone text NOT NULL,
  conference_url text,
  conference_status text NOT NULL DEFAULT 'PENDING'
    CHECK (conference_status = ANY (ARRAY['PENDING','READY','UNSUPPORTED','DELAYED'])),
  policy_version integer NOT NULL DEFAULT 1,
  attendee_email_hash text,
  correlation_id text,
  rescheduled_from uuid REFERENCES ops.appointments(id),
  exception_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_at_utc < end_at_utc)
);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_current_confirmed
  ON ops.appointments (case_id, purpose)
  WHERE status IN ('CONFIRMED','CONFIRMED_MEETING_LINK_PENDING');

CREATE UNIQUE INDEX IF NOT EXISTS appointments_provider_event_uniq
  ON ops.appointments (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- Resource overlap protection for active bookings (exclusion via unique time bands is hard;
-- enforce with advisory lock + range check in application; add supporting index)
CREATE INDEX IF NOT EXISTS appointments_resource_active_idx
  ON ops.appointments (calendar_resource_id, start_at_utc, end_at_utc)
  WHERE status IN ('CONFIRMED','CONFIRMED_MEETING_LINK_PENDING','PENDING_PROVIDER','OUTCOME_UNKNOWN','RESCHEDULE_PENDING');

CREATE TABLE IF NOT EXISTS ops.appointment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES ops.appointments(id),
  provider text NOT NULL DEFAULT 'test_calendar',
  provider_event_id text,
  event_kind text NOT NULL,
  precedence integer NOT NULL DEFAULT 0,
  payload_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_provider_events_uniq
  ON ops.appointment_provider_events (provider, provider_event_id, event_kind)
  WHERE provider_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ops.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES ops.appointments(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id),
  generation integer NOT NULL CHECK (generation >= 1),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status = ANY (ARRAY[
    'SCHEDULED','SENT','CANCELLED_APPOINTMENT','CANCELLED_RESCHEDULE','CANCELLED_STALE','CANCELLED_SUPPRESSED','CANCELLED_KILL'
  ])),
  job_idempotency_key text NOT NULL UNIQUE,
  outbound_intent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE (appointment_id, generation)
);

ALTER TABLE ops.booking_sessions
  DROP CONSTRAINT IF EXISTS booking_sessions_appointment_id_fkey;
ALTER TABLE ops.booking_sessions
  ADD CONSTRAINT booking_sessions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES ops.appointments(id);

COMMENT ON TABLE ops.booking_sessions IS 'A5 durable booking session; token_hash only, never raw bearer';
COMMENT ON TABLE ops.appointments IS 'A5 canonical appointment; provider create only after durable intent';
COMMENT ON TABLE ops.booking_slots IS 'A5 opaque slots bound to session generation; client selects slot_id only';

DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

ALTER TABLE ops.booking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.appointment_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.appointment_reminders ENABLE ROW LEVEL SECURITY;

COMMIT;
