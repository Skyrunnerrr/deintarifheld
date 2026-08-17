# A7-00 Executive Summary

DTH-A7 delivers a deterministic Energy + Tariff Domain Engine on E2 local synthetic fixtures.

- Inputs: A6 `getCaseEnergyEvidence` + lead baseline (never invent)
- Outputs: eligibility, micro-EUR pricing, comparable savings, ranking, A8 `OFFER_PREPARE` handoff
- Kill: `KillDomain.AUTOMATION_ENGINE` (no 9th KillDomain)
- LIVE_TARIFF=0 LIVE_SUPPLIER_API=0 LIVE_AI_A7=0
- A6 OWNER_* flags remain true/unresolved

