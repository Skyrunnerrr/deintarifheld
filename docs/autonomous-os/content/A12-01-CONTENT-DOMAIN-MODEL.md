# A12-01 Content Domain Model

Private `ops` tables (authoring/control). No JSON blob as runtime authority.

| Entity | Table | Role |
|---|---|---|
| Brief | `ops.content_briefs` | Structured brief; not a freeform prompt |
| Item | `ops.content_items` | Channel + status + current revision |
| Revision | `ops.content_revisions` | Immutable text; unique fingerprint; one current |
| Claim | `ops.content_claims` | Extracted claim + state |
| Approval | `ops.content_approvals` | One row per revision; hash-bound |
| Intent | `ops.content_publication_intents` | Durable intent before provider; unique idempotency key |
| Publication | `ops.content_publications` | One per intent; provider post id |
| Metrics | `ops.content_metric_snapshots` | Append-only provider evidence |

Statuses: DRAFT, VALIDATION_REQUIRED, BLOCKED, APPROVAL_REQUIRED, APPROVED, SCHEDULED, PUBLICATION_PENDING, PUBLISHED, FAILED, OUTCOME_UNKNOWN, CANCELLED, SUPERSEDED.

Grants: anon/authenticated SELECT/INSERT/UPDATE/DELETE = 0. RLS enabled. Memory calendar fallback = 0.
