# A4-02 Outbound Intent States

INTENT_CREATED → READY_TO_SEND → PROVIDER_ACCEPTED | FAILED | OUTCOME_UNKNOWN | CANCELLED_STALE  
Then DELIVERED / BOUNCED via provider events (monotonic precedence).
