# DeinTarifHeld Autonomous Operating System — Master Plan

STATUS=FROZEN_V2_0  
FROZEN_AT_UTC=2026-08-12  
FROZEN_HEAD=955e849d3f9006910a989727d9f21608a2f682e6  
CHANGE_CONTROL=ADR + Risk Review + Dependency Check only

## Core architecture decision

Agents are **not** the foundation.

```text
DETERMINISTIC WORKFLOW ORCHESTRATOR
  + Policy Engine
  + Domain Services
  + Data / Audit / Outbox
  + Security (Identity / AuthZ / RLS)
  + AI Workers (bounded, replaceable)
  + Human Oversight
```

AI solves bounded probabilistic tasks. Workflows and policy decide what is allowed.

## Evidence levels (mandatory)

| Level | Meaning |
|---|---|
| E0 | Claimed / planned only |
| E1 | Code present and inspected |
| E2 | Local tests pass |
| E3 | Integration/staging component pass |
| E4 | Staging end-to-end pass |
| E5 | Production smoke/readback proven |
| E6 | Production stable over observation window |

Never claim `COMPLETE` from E1/E2 alone.

## Canonical roadmap (operative)

```text
DTH-M0  FREEZE
DTH-M1  Repository inventory
DTH-M2  Secret scan
DTH-M3  Local backup / bundle
DTH-M4  Remote safety branch
DTH-M5  Remote SHA verification
DTH-M6  Close H0b3d readback
DTH-M7  Reconstruct persistent H0b3d/H0b4 evidence
DTH-M8  Phase-4 current-state reconciliation
DTH-M9  Canonical Runtime Architecture ADR
DTH-M10 Canonical Data / SoT ADR
DTH-M11 Lead → Ops lifecycle design
DTH-M12 Governance baseline
DTH-M13 H0b-MAP
DTH-M14 Capability model
DTH-M15 Strong server authorization
DTH-M16 RLS
DTH-M17 AuthZ/RLS adversarial tests
DTH-M18 Production-like staging
… (see Blueprint v2.0 §101 for M19–M36)
```

## Immediate rule

No autonomous runtime agents, no customer-mail activation, no production AuthZ/RLS claims, and no new product features until **M0–M5 = PASS** and canonical architecture ADRs exist.

## Non-goals (near term)

- Free “master agent”
- Autonomous price/contract decisions
- Broad marketing automation
- Premature microservice/Kubernetes sprawl
- Treating `/tmp` as audit evidence

---

## DTH-A0 AUTONOMY REALIGNMENT (2026-08-16)

Business-autonomy sequencing is frozen in `docs/autonomous-os/autonomy-realignment/`.

- Historical M0–M11 security/data plan remains valid as foundation.
- New execution layer: **A1–A14 Revenue-first Autonomy Map** (does not erase M11).
- Next implementation tranche: **DTH-A1 Durable Workflow Runtime**.
- See `autonomy-realignment/13_A0_A1_A14_EXECUTION_MAP.md` and `08_A0_M11_TO_AUTONOMY_MAPPING.md`.

