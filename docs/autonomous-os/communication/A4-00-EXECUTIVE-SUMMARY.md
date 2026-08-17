# A4-00 Executive Summary

**Tranche:** DTH-A4 Communication Engine  
**Base:** `15842871389dbb5fe22af8a131d833439193b2e2` (A3 closed tip)  
**Branch:** `feat/dth-a4-communication-engine-001`  
**Scope:** durable Case email conversation for missing-information only. Synthetic provider E2. No live Resend, no live AI, no calendar.

## Result (local E2)

A4 implements the first customer-facing autonomy loop on A1 jobs:

MISSING_INFORMATION → durable outbound intent → mock send → wait → verified inbound event → strong correlation → deterministic extraction → A3 observation → reevaluation → still missing or QUALIFIED_FOR_CALL.

Intake mail (`lib/leads/mail.js`) remains a separate confirmation/notification path.

## Non-goals proven absent

- LIVE_PROVIDER_CALLS=0
- LIVE_EMAIL_SENDS=0
- LIVE_AI_CALLS=0
- LIVE_CALENDAR_WRITES=0
- No marketing / acquisition send
- No attachment document processing (A6)
- No appointment offer send (A5)

## Next

DTH-A5 CALENDAR_AGENT  
STAGING_AUTONOMY_READY=NO  
PRODUCTION_AUTONOMY_READY=NO
