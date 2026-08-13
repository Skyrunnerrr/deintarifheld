# Evidence Index

## Dual-tier evidence (D-008)

| Tier | Location | Git |
|---|---|---|
| A Redacted reports | `docs/autonomous-os/evidence-reports/` | Commit after review |
| B Raw / provider | `~/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/` | Never |

`docs/autonomous-os/evidence/` remains gitignored legacy local path; prefer tiers A/B.

## Persistent evidence root (M0–M5)

```text
~/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/DTH-M0-M5/
```

## Milestone index

| Milestone | Status | Report | Raw | Notes |
|---|---|---|---|---|
| M0–M5 | PASS | `16_M0_M5_EXECUTION_REPORT.md` | `.../DTH-M0-M5/` | Safety `safety/dth-p3-p4-freeze-955e849` |
| M6 | OPEN / PARTIAL | `evidence-reports/DTH-M6.md` | `.../DTH-M6/` | Owner readback pending; Track A |
| M7 | PASS | `evidence-reports/DTH-M7.md` | `.../DTH-M7/` | 125/125 local; gaps explicit |
| M8 | PASS | `evidence-reports/DTH-M8.md` | `.../DTH-M8/` | Phase-4 reconciliation |
| M8C | PASS | `evidence-reports/DTH-M8C.md` | Safety `safety/dth-m8-canonical-4545c7b` | Terminology + remote freeze |
| M9 | PROVISIONAL→hardened | `evidence-reports/DTH-M9.md` | ADRs `docs/architecture/adr/ADR-001`…`016` | DTH-ERA-A dual-plane |
| M9R | PASS | `evidence-reports/DTH-M9R.md` | — | Red-team + hardenings; freeze pending Owner; no commit |

## Rules

- `/tmp` is **not** canonical audit evidence.
- Never store tokens, emails, OTP, cookies, or secret values in evidence.
- Agent “PASS” statements are not evidence.
- M6 must not be recorded as PASS while OPEN.

## DTH-M9 / M9R / M9F

| Artifact | Path |
|---|---|
| M9 architecture | docs/autonomous-os/evidence-reports/DTH-M9.md |
| M9R adversarial | docs/autonomous-os/evidence-reports/DTH-M9R.md |
| M9F freeze | docs/autonomous-os/evidence-reports/DTH-M9F.md |
| ADRs | docs/architecture/adr/ADR-001.md … ADR-016.md |
| Architecture | docs/autonomous-os/02_ARCHITECTURE.md |
| Control matrix | docs/autonomous-os/05_CONTROL_MATRIX.md |

## DTH-M10

| Artifact | Path |
|---|---|
| Data architecture | docs/autonomous-os/06_DATA_ARCHITECTURE.md |
| Evidence report | docs/autonomous-os/evidence-reports/DTH-M10.md |
| ADRs | docs/architecture/adr/ADR-017.md … ADR-032.md |

## DTH-M10R

| Artifact | Path |
|---|---|
| M10R evidence | docs/autonomous-os/evidence-reports/DTH-M10R.md |
| ADR-033 | docs/architecture/adr/ADR-033.md |
| ADR-034 | docs/architecture/adr/ADR-034.md |

## DTH-M10F

| Artifact | Path |
|---|---|
| M10F freeze | docs/autonomous-os/evidence-reports/DTH-M10F.md |
| Data architecture | docs/autonomous-os/06_DATA_ARCHITECTURE.md |
| ADRs | ADR-017 … ADR-034 |

## DTH-M11A

| Artifact | Path |
|---|---|
| Implementation plan | docs/autonomous-os/07_IMPLEMENTATION_PLAN.md |
| Evidence | docs/autonomous-os/evidence-reports/DTH-M11A.md |

## DTH-M11B

| Artifact | Path |
|---|---|
| Evidence report | docs/autonomous-os/evidence-reports/DTH-M11B.md |
| Local manifest | docs/autonomous-os/evidence/DTH-M11B/local-migration-manifest.txt |
| Owner readback packet | docs/autonomous-os/evidence/DTH-M11B/OWNER_READBACK_PACKET.md |

## DTH-M11B Final

| Artifact | Path |
|---|---|
| Final report | docs/autonomous-os/evidence-reports/DTH-M11B.md |
| R2 reconciliation | docs/autonomous-os/evidence/DTH-M11B/r2-reconciliation.json |
| Baseline ID | DTH-PROD-DB-20260813-de5e6bd1ecf4 |

## DTH-M11ABF

| Artifact | Path |
|---|---|
| Freeze report | docs/autonomous-os/evidence-reports/DTH-M11ABF.md |
| Implementation plan | docs/autonomous-os/07_IMPLEMENTATION_PLAN.md |
| M11A | docs/autonomous-os/evidence-reports/DTH-M11A.md |
| M11B | docs/autonomous-os/evidence-reports/DTH-M11B.md |
| Baseline ID | DTH-PROD-DB-20260813-de5e6bd1ecf4 |
| Raw evidence limitation | DEGRADED_WORKSPACE_GITIGNORED |

## DTH-M11C

| Artifact | Path |
|---|---|
| Evidence report | docs/autonomous-os/evidence-reports/DTH-M11C.md |
| Raw evidence (preferred) | ~/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/DTH-M11C/ |
| Workspace gitignored mirror | docs/autonomous-os/evidence/DTH-M11C/ |
| Status | OPEN — Owner actions required |

### M11C-R4 artifacts

| Artifact | Path |
|---|---|
| Migration list | evidence/DTH-M11C/r4-migration-list.txt |
| Schema dump | evidence/DTH-M11C/r4-schema-dump.sql |
| Parity JSON | evidence/DTH-M11C/r4-parity.json |
| Fingerprint | evidence/DTH-M11C/r4-fingerprint.txt |
| App Support root | ~/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/DTH-M11C/ |

## DTH-M11CF

| Artifact | Path |
|---|---|
| Freeze report | docs/autonomous-os/evidence-reports/DTH-M11CF.md |
| M11C report | docs/autonomous-os/evidence-reports/DTH-M11C.md |
| Staging ref | uunpbmfvbfkideylhtbl |
| Staging fingerprint | f59f5e619c4a5909bec409c797cc094726b2dd7f9d6a2493bab9dc092863e8de |
| Next | M11D after freeze |

## DTH-M11D

| Artifact | Path |
|---|---|
| R0 audit | docs/autonomous-os/evidence-reports/DTH-M11D-R0.md |
| R1 freeze | docs/autonomous-os/evidence-reports/DTH-M11D-R1.md |
| Model | MODEL_A / postgres DDL authority V1 |
| Next | M11E |

## DTH-M11E

| Artifact | Path |
|---|---|
| R0 audit | docs/autonomous-os/evidence-reports/DTH-M11E-R0.md |
| P0 queue reconciliation | docs/autonomous-os/evidence-reports/DTH-M11E-P0.md |
| R1A pre-apply freeze | docs/autonomous-os/evidence-reports/DTH-M11E-R1A.md |
| R1B Staging apply | docs/autonomous-os/evidence-reports/DTH-M11E-R1B.md |
| R2 behavioral tests | docs/autonomous-os/evidence-reports/DTH-M11E-R2.md |
| R3A routine default decision | docs/autonomous-os/evidence-reports/DTH-M11E-R3A.md |
| R3B pre-apply freeze | docs/autonomous-os/evidence-reports/DTH-M11E-R3B.md |
| R3B migration | supabase/migrations/20260813171649_m11e_global_routine_default_hardening.sql |
| R3B SHA256 | 871c20524ee8c4c98a36e795051fa545f205676c988082854ec8034969b6dca5 |
| R2 non-applying SQL | scripts/security-tests/dth-m11e-r2-transactional-negative-test.sql |
| R3A non-applying SQL | scripts/security-tests/dth-m11e-r3a-transactional-global-routine-default-test.sql |
| R1A migration | supabase/migrations/20260813104040_m11e_private_schema_default_privileges.sql |
| R1A/R1B SHA256 | 04c8dd4b03f840ba641f934d5e1d8bd1ebefb95854f39b1b4c21dd02f44aa4db |
| Archive | archive/supabase-migrations/pre-m11-security/ |
| Next | M11E-R3C |
