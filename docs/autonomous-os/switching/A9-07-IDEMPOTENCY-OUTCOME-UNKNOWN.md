# A9-07 Idempotency and outcome unknown

Durable `switch_submission_intents` committed before provider call. Timeout → OUTCOME_UNKNOWN, reconcile job, no blind second order. Duplicate provider response → reconcile, not resubmit. DTH idempotency key is canonical.
