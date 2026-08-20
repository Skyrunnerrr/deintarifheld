# A12-11 Scheduling

Authority is durable `ops.content_publication_intents` (`scheduled_at`, state `SCHEDULED`). No in-memory calendar.

`scheduleContentPublication` requires current approved revision, matching hash, control gate. Idempotency key: `content-pub:{revisionId}:{contentHash}`.

Due scan: `listDueContentPublicationIntents`. A1 capabilities (registered, same functions as E2 tests):

- `CONTENT_PUBLICATION_DUE` → `publishContentIntent`
- `CONTENT_RECONCILE` → `reconcileContentPublication`
- `CONTENT_METRICS_REFRESH` → `refreshContentMetrics`

E2 tests invoke the domain functions directly. Cancel / superseded revision / global kill / control unavailable → provider calls = 0.
