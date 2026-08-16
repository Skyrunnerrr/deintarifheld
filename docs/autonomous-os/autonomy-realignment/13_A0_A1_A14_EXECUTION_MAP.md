# A0 → A1–A14 Execution Map (FROZEN)

| ID | Title | Business outcome | Embeds M11 | Entry | Exit |
|----|-------|------------------|------------|-------|------|
| **A1** | Durable Workflow Runtime | Motor: loop, jobs, lease, retry, DLQ, kill/CONTROL_VERSION hooks | M11V + M11O (durable kill) | A0 PASS | Local continuous worker processes durable jobs with crash recovery |
| **A2** | Lead→Case Autopilot | Every valid B2B lead → durable event → case → workflow | M11T | A1 exit | Synthetic lead creates case without human copy |
| **A3** | Qualification + Missing Info | Gaps/contradictions detected; confidence/escalation | — | A2 | Missing consumption detected automatically |
| **A4** | Communication Engine | Outbound intents + inbound correlate + follow-ups | — | A3 | Question sent + reply matched (test adapter) |
| **A5** | Calendar Agent | Slots, book, confirm, remind | — | A4 | Synthetic booking → OFFER_INPUT_READY |
| **A6** | Document Intelligence | Upload→extract→validate | — | E2E-01 optional | Invoice fields update case |
| **A7** | Energy/Tariff Domain Engine | Deterministic comparison | — | A5/A6 | Savings/price evidence traced |
| **A8** | Offer Engine | Versioned offer, policy, send, follow-up | — | A7 | Offer sent via intent path |
| **A9** | Switching Workflow | Supplier process + status | — | A8 accept | Switch confirmed state |
| **A10** | Lifecycle + Renewal | Active customer + renewal due | — | A9 | Renewal loop schedules evaluation |
| **A11** | Production Command Center | Exception cockpit + controls | M11H–N staging gates | A5+ | Founder operates by exception |
| **A12** | Content Autopilot | Plan→approve→publish→readback | — | after revenue loop | Bounded auto posts |
| **A13** | Acquisition Autopilot | Separate acquisition domain | — | after A12 | Controlled outbound |
| **A14** | Autonomy Rollout | Shadow→Suggest→Bounded→Routine | M11Q/R/S prod gates | staging E2E green | Production autonomy levels Owner-controlled |

## Staging security track (parallel, not a second product)

M11F→G→H→I→J→K→L→M→N→O→P must gate **staging** autonomy proofs. Local A1–A5 may proceed with explicit LOCAL_ONLY evidence labels.


## A1 status update (do not rewrite A0 history)

- A1: IMPLEMENTED_E2_LOCAL — see `docs/autonomous-os/autonomy-runtime/`
- M11O: PARTIALLY_CONSUMED_E2_LOCAL (durable kill + CONTROL_VERSION local)
- M11V: IMPLEMENTED_E2_LOCAL (workflow/job persistence local)
- Staging/production autonomy: NO (M11F–P pending)
- Next: DTH-A2 LEAD_TO_CASE_AUTOPILOT


## A2 status update

- A2: IMPLEMENTED_E2_LOCAL — see `docs/autonomous-os/lead-case-autopilot/`
- M11T: IMPLEMENTED_E2_LOCAL
- M11Q/R/S: PENDING
- Next: DTH-A3 QUALIFICATION_AND_MISSING_INFO
