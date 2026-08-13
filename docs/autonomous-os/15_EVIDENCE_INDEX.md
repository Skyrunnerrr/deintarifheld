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
| M8C | PASS (this freeze) | `evidence-reports/DTH-M8C.md` | (commit is freeze) | Terminology + remote safety |

## Rules

- `/tmp` is **not** canonical audit evidence.
- Never store tokens, emails, OTP, cookies, or secret values in evidence.
- Agent “PASS” statements are not evidence.
- M6 must not be recorded as PASS while OPEN.
