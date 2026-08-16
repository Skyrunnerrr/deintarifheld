-- DTH-A1 Durable Workflow Runtime
-- AUTHORIZED_ENVIRONMENT=LOCAL_TEST_ONLY (do not apply to production)
-- Consumes M11V (workflow persistence) + M11O (durable kill / CONTROL_VERSION) concepts.
-- Reuses private schemas workflow + security when present (M11E).

BEGIN;

CREATE SCHEMA IF NOT EXISTS workflow AUTHORIZATION CURRENT_USER;
CREATE SCHEMA IF NOT EXISTS security AUTHORIZATION CURRENT_USER;

REVOKE ALL ON SCHEMA workflow FROM PUBLIC;
REVOKE ALL ON SCHEMA security FROM PUBLIC;

-- Monotonic global control version (invalidate stale jobs)
CREATE TABLE IF NOT EXISTS security.control_version (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO security.control_version (id, version) VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

-- Durable kill / pause / domain controls
CREATE TABLE IF NOT EXISTS security.control_state (
  scope text NOT NULL CHECK (scope IN ('GLOBAL', 'DOMAIN', 'WORKFLOW', 'CASE')),
  scope_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE', 'INACTIVE', 'PAUSED', 'TAKEOVER')),
  reason text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, scope_key)
);

CREATE TABLE IF NOT EXISTS security.control_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  scope_key text NOT NULL,
  from_state text,
  to_state text NOT NULL,
  control_version bigint NOT NULL,
  reason text,
  actor text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type text NOT NULL,
  workflow_version integer NOT NULL DEFAULT 1 CHECK (workflow_version >= 1),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  case_id text,
  status text NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'WAITING', 'PAUSED', 'BLOCKED_EXCEPTION', 'COMPLETED', 'CANCELLED')),
  current_state text NOT NULL,
  correlation_id text NOT NULL,
  control_version_at_start bigint NOT NULL DEFAULT 1,
  failure_class text,
  failure_code text,
  metadata_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (workflow_type, aggregate_type, aggregate_id, correlation_id)
);

CREATE INDEX IF NOT EXISTS workflow_instances_status_idx
  ON workflow.workflow_instances (status, updated_at);

CREATE TABLE IF NOT EXISTS workflow.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id uuid NOT NULL REFERENCES workflow.workflow_instances(id),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'READY'
    CHECK (status IN (
      'READY', 'LEASED', 'RUNNING', 'SUCCEEDED',
      'RETRY_SCHEDULED', 'FAILED_PERMANENT', 'DEAD_LETTER', 'CANCELLED'
    )),
  priority integer NOT NULL DEFAULT 100,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  lease_owner text,
  lease_expires_at timestamptz,
  lease_generation integer NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  idempotency_key text NOT NULL,
  correlation_id text NOT NULL,
  control_version bigint NOT NULL DEFAULT 1,
  last_error_class text,
  last_error_code text,
  payload_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS jobs_claim_idx
  ON workflow.jobs (status, scheduled_at, priority DESC, created_at, id);

CREATE INDEX IF NOT EXISTS jobs_lease_expiry_idx
  ON workflow.jobs (lease_expires_at)
  WHERE status IN ('LEASED', 'RUNNING');

CREATE INDEX IF NOT EXISTS jobs_workflow_idx
  ON workflow.jobs (workflow_instance_id, created_at);

CREATE TABLE IF NOT EXISTS workflow.job_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES workflow.jobs(id),
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  worker_id text NOT NULL,
  lease_generation integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result text CHECK (result IS NULL OR result IN (
    'SUCCEEDED', 'RETRY_SCHEDULED', 'FAILED_PERMANENT', 'DEAD_LETTER',
    'CANCELLED', 'BLOCKED_CONTROL', 'STALE_LEASE', 'CRASHED'
  )),
  error_class text,
  error_code text,
  UNIQUE (job_id, attempt_number)
);

-- Seed global automation kill as INACTIVE (automation allowed when inactive)
INSERT INTO security.control_state (scope, scope_key, state, reason, updated_by)
VALUES ('GLOBAL', 'AUTOMATION', 'INACTIVE', 'A1 default: automation allowed', 'SYSTEM')
ON CONFLICT (scope, scope_key) DO NOTHING;

COMMIT;
