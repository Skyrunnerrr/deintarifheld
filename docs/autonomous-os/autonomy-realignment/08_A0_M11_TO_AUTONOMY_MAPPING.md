# A0 M11 → Autonomy Mapping

**Principle:** Integrate unfinished M11 into A1–A14. Do not run a second competing roadmap.

| M11 | Title | Classification | Consumed by |
|-----|-------|----------------|-------------|
| M11E | Private schema hardening | DONE at R4 baseline; freeze docs at adjacent `3ed243b` | Foundation |
| M11F | Runtime LOGIN roles | REQUIRED_BEFORE_STAGING_AUTONOMY | A1 staging gate / Security track |
| M11G | Object grants (ACL-02) | REQUIRED_BEFORE_STAGING_AUTONOMY | same |
| M11H | OPERATOR_PERSON mapping | REQUIRED_BEFORE_STAGING_AUTONOMY | A11 / AuthZ track |
| M11I | Capability assignments | REQUIRED_BEFORE_STAGING_AUTONOMY | AuthZ track |
| M11J | Strong App AuthZ | REQUIRED_BEFORE_STAGING_AUTONOMY | AuthZ track |
| M11K | Request-scoped DB context | REQUIRED_BEFORE_STAGING_AUTONOMY | AuthZ track |
| M11L | RLS wave 1 | REQUIRED_BEFORE_STAGING_AUTONOMY | AuthZ track |
| M11M | RLS wave 2 ops | REQUIRED_BEFORE_STAGING_AUTONOMY | AuthZ track |
| M11N | Durable session registry | REQUIRED_BEFORE_STAGING_AUTONOMY | A11 |
| M11O | Durable kill + CONTROL_VERSION | REQUIRED_DURING_A1 (local can stub; staging hard req) | **A1** |
| M11P | Staging E2E AuthZ→Ops | REQUIRED_BEFORE_STAGING_AUTONOMY | before AUTONOMY-E2E-01 staging |
| M11Q | PUBLIC_INTAKE LOGIN + atomic txn | REQUIRED_BEFORE_PRODUCTION_AUTONOMY | A2 prod path |
| M11R | Career purpose boundary | REQUIRED_BEFORE_PRODUCTION_AUTONOMY | prod cutover |
| M11T | Source outbox + Public→Ops handoff | REQUIRED_DURING_A2 | **A2** |
| M11S | service_role retirement | REQUIRED_BEFORE_PRODUCTION_AUTONOMY | after Q/R/T |
| M11U | EXTERNAL_PARTY + DSR | CAN_DEFER | compliance maturity |
| M11V | Workflow persistence | REQUIRED_DURING_A1 | **A1** |

## Minimum safe path to first LOCAL synthetic autonomous slice

```text
A1 (workflow motor + promote job/outbox drafts locally)
→ A2 (lead→case + source outbox local/synthetic)
→ A3 + A4 + A5
→ DTH-AUTONOMY-E2E-01 (local/test adapters)
```

## Minimum safe path to STAGING autonomous slice

```text
M11F→G→H→I→J→K→L→M→N→O→P embedded as staging gates
+ A1–A5 proven locally
→ staging AUTONOMY-E2E-01
```
