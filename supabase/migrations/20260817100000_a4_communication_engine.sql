-- DTH-A4 Communication Engine (local additive, ops private)
-- Does NOT promote draft public.communication_events (DEFER).
-- LIVE provider/DNS/webhook registration: NOT in this migration.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ops.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  workflow_instance_id uuid REFERENCES workflow.workflow_instances(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'EMAIL' CHECK (channel = 'EMAIL'),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status = ANY (ARRAY[
    'OPEN','WAITING_CUSTOMER','ACTION_REQUIRED','QUALIFIED','HUMAN_REVIEW','CLOSED'
  ])),
  conversation_ref text NOT NULL UNIQUE,
  do_not_automatically_contact boolean NOT NULL DEFAULT false,
  followup_count integer NOT NULL DEFAULT 0 CHECK (followup_count >= 0),
  max_followups integer NOT NULL DEFAULT 1 CHECK (max_followups >= 0),
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, channel)
);

CREATE TABLE IF NOT EXISTS ops.outbound_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ops.conversations(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  purpose text NOT NULL CHECK (purpose = ANY (ARRAY[
    'MISSING_INFORMATION_REQUEST','MISSING_INFORMATION_FOLLOWUP'
  ])),
  state text NOT NULL DEFAULT 'INTENT_CREATED' CHECK (state = ANY (ARRAY[
    'INTENT_CREATED','READY_TO_SEND','PROVIDER_ACCEPTED','DELIVERED','BOUNCED',
    'FAILED','OUTCOME_UNKNOWN','CANCELLED_STALE','RECONCILIATION_REQUIRED'
  ])),
  qualification_revision integer NOT NULL CHECK (qualification_revision >= 1),
  requirement_ids uuid[] NOT NULL DEFAULT '{}',
  requirement_fingerprint text NOT NULL,
  dth_idempotency_key text NOT NULL UNIQUE,
  communication_policy_version integer NOT NULL DEFAULT 1,
  template_id text NOT NULL,
  template_version integer NOT NULL DEFAULT 1,
  content_hash text,
  subject text,
  body_text text,
  recipient_email_hash text,
  recipient_snapshot_redacted text,
  provider text NOT NULL DEFAULT 'resend_test',
  provider_message_id text,
  provider_idempotency_key text,
  followup_generation integer NOT NULL DEFAULT 0,
  failure_class text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS outbound_intents_case_idx ON ops.outbound_intents (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outbound_intents_state_idx ON ops.outbound_intents (state) WHERE state IN ('INTENT_CREATED','READY_TO_SEND','OUTCOME_UNKNOWN');

CREATE TABLE IF NOT EXISTS ops.communication_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ops.conversations(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  direction text NOT NULL CHECK (direction = ANY (ARRAY['OUTBOUND','INBOUND'])),
  message_type text NOT NULL,
  outbound_intent_id uuid REFERENCES ops.outbound_intents(id),
  provider_message_id text,
  subject text,
  body_text text,
  body_html_present boolean NOT NULL DEFAULT false,
  attachment_present boolean NOT NULL DEFAULT false,
  attachment_count integer NOT NULL DEFAULT 0,
  content_hash text,
  qualification_revision integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communication_messages_conv_idx ON ops.communication_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ops.provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'resend_test',
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_message_id text,
  outbound_intent_id uuid REFERENCES ops.outbound_intents(id),
  inbound_event_id uuid,
  payload_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  precedence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS ops.inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'resend_test',
  provider_event_id text NOT NULL UNIQUE,
  provider_email_id text NOT NULL,
  message_id_header text,
  from_address text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  subject text,
  attachment_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status = ANY (ARRAY[
    'RECEIVED','RETRIEVED','CORRELATED','INTERPRETED','PROCESSED',
    'UNMATCHED','CORRELATION_REVIEW','HUMAN_REVIEW','FAILED_PERMANENT'
  ])),
  conversation_id uuid REFERENCES ops.conversations(id),
  case_id uuid REFERENCES public.cases(id),
  correlation_tier text,
  body_text text,
  automated_reply boolean NOT NULL DEFAULT false,
  interpretation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS inbound_events_provider_email_uidx
  ON ops.inbound_events (provider, provider_email_id);

CREATE TABLE IF NOT EXISTS ops.followup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ops.conversations(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  outbound_intent_id uuid NOT NULL REFERENCES ops.outbound_intents(id),
  generation integer NOT NULL CHECK (generation >= 1),
  due_at timestamptz NOT NULL,
  job_idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status = ANY (ARRAY[
    'SCHEDULED','CLAIMED','SENT','CANCELLED_REPLY','CANCELLED_QUALIFIED',
    'CANCELLED_STALE','CANCELLED_BOUNCE','CANCELLED_MAX','CANCELLED_KILL'
  ])),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, generation)
);

ALTER TABLE ops.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.outbound_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.followup_schedules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

COMMENT ON TABLE ops.conversations IS 'A4 case email conversation — communication state only';
COMMENT ON TABLE ops.outbound_intents IS 'A4 durable outbound intents; provider call only after pre-send checks';

ALTER TABLE ops.conversations
  DROP CONSTRAINT IF EXISTS conversations_workflow_instance_id_fkey;
ALTER TABLE ops.conversations
  ADD CONSTRAINT conversations_workflow_instance_id_fkey
    FOREIGN KEY (workflow_instance_id) REFERENCES workflow.workflow_instances(id)
    ON DELETE SET NULL;

COMMIT;
