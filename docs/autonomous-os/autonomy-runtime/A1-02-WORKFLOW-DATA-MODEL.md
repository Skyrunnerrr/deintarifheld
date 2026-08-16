# A1 Workflow Data Model

Schemas: `workflow`, `security` (private; M11E-compatible).

## Tables

- `workflow.workflow_instances` — orchestration state, version, aggregate refs, pause/cancel timestamps
- `workflow.jobs` — executable units with lease, schedule, attempts, idempotency, control_version
- `workflow.job_attempts` — operational execution history
- `security.control_version` — singleton monotonic version
- `security.control_state` — GLOBAL/DOMAIN/WORKFLOW/CASE controls
- `security.control_audit` — durable control change audit

## Ownership

- OUTBOX_OWNERSHIP: domain event durability / handoff
- WORKFLOW_OWNERSHIP: orchestration state machine
- JOB_OWNERSHIP: executable unit + lease/retry/DLQ

No secrets / raw LLM memory / unbounded payloads (`MAX_PAYLOAD_BYTES=4096`).
