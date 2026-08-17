# A4-02 Outbound Intent State Machine

```
INTENT_CREATED → READY_TO_SEND → PROVIDER_ACCEPTED → DELIVERED
                              ↘ FAILED
                              ↘ OUTCOME_UNKNOWN → RECONCILIATION_REQUIRED
                              ↘ CANCELLED_STALE
PROVIDER_ACCEPTED → BOUNCED
```

Monotonic delivery: `delivered` / `bounced` do not regress to `sent`.

Provider call is outside the intent-create transaction.

Non-sendable states never call the provider again: PROVIDER_ACCEPTED, DELIVERED, BOUNCED, FAILED, OUTCOME_UNKNOWN, CANCELLED_STALE, RECONCILIATION_REQUIRED.

Timeout / unknown acceptance → OUTCOME_UNKNOWN. Blind retry forbidden. DTH idempotency key is the durable authority; Resend keys last 24 hours only.
