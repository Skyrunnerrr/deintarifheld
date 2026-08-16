# A1 Job State Machine

Canonical states: `READY | LEASED | RUNNING | SUCCEEDED | RETRY_SCHEDULED | FAILED_PERMANENT | DEAD_LETTER | CANCELLED`

## Transitions (server-side only)

| From | Event | To |
|------|-------|----|
| READY/RETRY_SCHEDULED | claim (due) | LEASED |
| LEASED | start handler | RUNNING |
| LEASED/RUNNING | success CAS | SUCCEEDED |
| LEASED/RUNNING | retryable + under max | RETRY_SCHEDULED |
| LEASED/RUNNING | retryable exhausted | DEAD_LETTER |
| LEASED/RUNNING | permanent/control | FAILED_PERMANENT |
| * | cancel | CANCELLED |
| LEASED/RUNNING + lease expired | reclaim | READY |

Invalid transitions fail closed (0-row CAS).

Workflow states: `RUNNING | WAITING | PAUSED | BLOCKED_EXCEPTION | COMPLETED | CANCELLED`
