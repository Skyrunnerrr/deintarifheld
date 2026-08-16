# A1 Outbox ↔ Workflow Boundary

Outbox remains the durable domain/event handoff. Jobs are executable units. Workflows are orchestration.

A1 synthetic ingest: `ingestSyntheticOutboxEvent` → idempotent `startWorkflowIdempotent`.

A2 handoff API: `enqueueLeadAcceptedWorkflowStart({ leadId, correlationId })` — no business case creation yet.
