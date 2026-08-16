# Idempotency & Reconciliation

reconcileLeadToCaseHandoff is safe to replay. Completion requires Case + Workflow + initial job before outbox PROCESSED.

Duplicates prevented by: lead idempotency_key, outbox idempotency_key, cases unique source_lead, workflow unique aggregate, job idempotency_key.
