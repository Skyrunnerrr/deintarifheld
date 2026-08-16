# A2 Current → Target Map

| Area | Before | After A2 |
|------|--------|----------|
| Public intake | Supabase Data API insert | REUSED; local atomic path proven E2 |
| Source handoff | Missing | transactional_outbox + BUSINESS_LEAD_ACCEPTED |
| Case | Draft only | Canonical migration + autopilot create |
| Workflow | A1 motor only | Auto-started B2B_INBOUND_CUSTOMER |
| Qualification | — | Placeholder job only (A3 owns logic) |
