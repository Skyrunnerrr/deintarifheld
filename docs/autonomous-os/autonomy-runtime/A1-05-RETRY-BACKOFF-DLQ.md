# A1 Retry / Backoff / DLQ

- Retryable classes: TRANSIENT, RATE_LIMITED, TIMEOUT_OUTCOME_KNOWN_NOT_EXECUTED
- Permanent: VALIDATION_PERMANENT, UNKNOWN_CAPABILITY, POISON_PAYLOAD, CONTROL_BLOCKED, …
- Backoff: `min(max, base * 2^(attempt-1))` + ±10% jitter; defaults base 100ms, max 5s
- DLQ: DEAD_LETTER + workflow BLOCKED_EXCEPTION
- Reprocess: new job row, original DLQ history preserved, current controls respected
