# A0 Workflow Kernel Requirements (A1 contract)

## Semantics

```text
AT-LEAST-ONCE delivery + idempotent / reconcilable side effects
PRODUCTION_EXACTLY_ONCE_GUARANTEE=NO (honest)
```

## Minimum durable objects (reconcile with drafts; do not invent parallel outbox)

- workflow_instances (or case-linked workflow)
- jobs (type, payload ref, status, scheduled_at, priority, attempt_count, max_attempts, lease_owner, lease_expires_at, idempotency_key, correlation_id, case_id, control_version, last_error_class)
- job_attempts / audit linkage
- reuse/extend `transactional_outbox` where it already matches intent dispatch

## Job states (candidate — reconcile in A1)

PENDING, READY, LEASED, RUNNING, WAITING, SUCCEEDED, RETRY_SCHEDULED, FAILED, DEAD_LETTER, CANCELLED

## Must support

durable queue, crash recovery, delayed jobs, retry+jitter, max attempts, DLQ, reprocess, leases+expiry recovery, pause/takeover, domain+global kill, CONTROL_VERSION freshness, bounded concurrency, observability.

## Must not

replace Postgres with Kafka/Temporal/Redis for V1; allow provider calls before durable intent; treat timeout as confirmed failure without reconcile.
