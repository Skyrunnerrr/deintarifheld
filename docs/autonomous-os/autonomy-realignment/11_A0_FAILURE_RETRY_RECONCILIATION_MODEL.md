# A0 Failure / Retry / Reconciliation Model

| Failure | Class |
|---------|-------|
| DB unavailable | BLOCK / RETRY |
| Worker crash mid-job | RETRY via lease expiry |
| Lease expires | RECONCILE + RETRY idempotent |
| Duplicate event/webhook/email | NOOP via idempotency_key |
| Provider timeout | RECONCILE (not blind fail/success) |
| Provider partial success | RECONCILE |
| Calendar/mail timeout | RECONCILE |
| LLM timeout/malformed/hallucination | RETRY or ESCALATE; never invent facts |
| Low confidence | ESCALATE / NEEDS_HUMAN_REVIEW |
| Contradictory customer data | ESCALATE |
| Stale CONTROL_VERSION | CANCEL / BLOCK |
| Human takeover | CANCEL stale automation jobs |
| Global/domain kill | BLOCK new work; cancel/lease-drain |
| Poison job | DLQ |
| Permanent provider rejection | DLQ / ESCALATE |

Preferred: AT-LEAST-ONCE + idempotent side effects.
