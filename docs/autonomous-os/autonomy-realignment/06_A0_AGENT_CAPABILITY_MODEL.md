# A0 Agent / Capability Model

## Rule

Prefer **deterministic services + workflow capabilities**. Use AI only where unstructured interpretation is required.

| ID | Name | Type | Necessity | First tranche |
|----|------|------|-----------|---------------|
| AGENT-00 | Orchestrator | Workflow kernel (deterministic) | Required | A1 |
| AGENT-01 | Qualification | Hybrid (rules + optional LLM extract) | Required | A3 |
| AGENT-02 | Communication | Hybrid (templates + LLM draft) | Required | A4 |
| AGENT-03 | Document | Hybrid | Later | A6 |
| AGENT-04 | Calendar | Deterministic + provider adapter | Required for E2E-01 | A5 |
| AGENT-05 | Tariff | **Deterministic engine** (LLM may explain only) | Later | A7 |
| AGENT-06 | Offer | Deterministic + templates | Later | A8 |
| AGENT-07 | Switching | Deterministic workflow | Later | A9 |
| AGENT-08 | Customer Lifecycle | Deterministic | Later | A10 |
| AGENT-09 | Content | Hybrid | Deferred | A12 |

No dynamic agent creation in V1. Canonical registry only. Path: Capability → Tool → Policy/AuthZ → Domain → Intent/Outbox → Worker → Provider → Readback.
