# A1 Capability Registry

Server-side Map only. Unknown capability → FAILED_PERMANENT.

Synthetic handlers: NOOP, TRANSIENT_FAIL_THEN_SUCCESS, PERMANENT_FAIL, LONG_RUNNING, EFFECT_INTENT_DENIED, CHAIN_STEP, POISON.

Forbidden: eval, dynamic import from payload, shell, RUN_SCRIPT.
