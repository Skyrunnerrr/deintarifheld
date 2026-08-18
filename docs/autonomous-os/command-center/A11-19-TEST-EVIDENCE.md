# A11-19 Test Evidence

`npm run test:dth:a11` — 15/15 pass (logical coverage A11-01…A11-42 grouped).

## Pre-A11 baseline (before A11 commits)

- A10 18/18 PASS
- A9 PASS, A8 PASS
- A1/A2/A3 isolated PASS
- A1/A2/A3 sequential after A4–A10: HARNESS_ISOLATION_FLAKE (preexisting)
- CC / Ops / shared / DB / workers stub / boundary / lead contract / lint / build PASS

## Post-A11 regression (A11R — tip `df03d15`)

Domain suites re-run from A11 tip:

| Suite | Sequential after A11 tip | Isolated after local wipe |
|---|---|---|
| A10 | 18/18 PASS | — |
| A9 | 24/24 PASS | — |
| A8 | 24/24 PASS | — |
| A7 | 25/25 PASS | — |
| A6 | 25/25 PASS | — |
| A5 | 15/15 PASS | — |
| A4 | 23/23 PASS | — |
| A3 | 17/18 FAIL (`A3-31` handoff) | 18/18 PASS (reproved twice) |
| A2 | 14/16 FAIL (`A2-16` undercount; stress undercount) | 16/16 PASS (reproved twice) |
| A1 | 39/39 PASS | 39/39 PASS |

Sequential A2/A3 failure signatures match preexisting polluted-pool / `createLocalOutboxPool(max:2)` concurrent-drain flake. Classification: `HARNESS_ISOLATION_FLAKE_PREEXISTING` only. No A1–A3 runtime source change in A11 commits. `A11_CRITICAL_DOMAIN_REGRESSIONS=0`.

Platform:

- `cc:ui:test` PASS
- `ops:bff:test` PASS
- `leads:mail:test` PASS (mocked fetch; no live Resend)
- `leads:contract` PASS
- `workers:test` PASS
- `db:draft:test` PASS
- `kill:test` PASS
- `packages:boundary:check` PASS
- lint PASS
- build PASS (`NEXT_DIST_DIR=.next-a11r-regression`)

M11: `M11_NAMED_REGRESSION_SCRIPT=NOT_PRESENT`. Covered by suite grant checks (A11-01 `ops.operator_commands` anon/authenticated 0; A4–A10 grant assertions in post-A11 runs).
