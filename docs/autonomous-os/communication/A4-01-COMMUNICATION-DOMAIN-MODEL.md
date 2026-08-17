# A4-01 Domain Model

**REUSE:** A1 jobs, A3 qualification APIs, KillDomain.INTERNAL_MAIL (maps COMMUNICATION)  
**EXTEND:** `ops` schema with conversations, outbound_intents, communication_messages, provider_events, inbound_events, followup_schedules  
**DEFER:** draft `public.communication_events` (P3-F2a) — not promoted  
**SUPERSEDE:** none of intake `lib/leads/mail.js`

Authorities: A3=qualification, A4=messages/intents, A1=execution, Case=identity, Provider=delivery facts.
