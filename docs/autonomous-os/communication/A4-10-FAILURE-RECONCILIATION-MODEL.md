# A4-10 Failure / Reconciliation Model

| Failure | Behavior |
|---|---|
| Crash before provider | lease expires; retry with fresh checks; one send |
| Provider timeout / unknown | OUTCOME_UNKNOWN; no blind retry |
| Crash after provider before DB | OUTCOME_UNKNOWN / reconciliation; DTH key prevents duplicate logical send |
| Permanent send fail | FAILED; no follow-up |
| Bounce | BOUNCED; follow-up cancelled; no repeat send |
| Retrieve transient | A1 retry |
| Retrieve permanent | FAILED_PERMANENT inbound; no Case mutation |
| Webhook duplicate | idempotent ACK |
| Crash after observation | observation idempotency key prevents duplicate; reevaluate reuses fingerprint |
| Control unread before send | no provider call |
| Control unread on inbound | verified event may persist; autonomous processing defers |
| Poison inbound | isolated; worker continues |

MEMORY_COMMUNICATION_FALLBACKS=0  
JSON_COMMUNICATION_FALLBACKS=0
