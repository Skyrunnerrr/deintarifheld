# A12-19 Test Evidence

`npm run test:dth:a12` — 13/13 pass (logical coverage A12-01…A12-38 + E2E claim/publication/A11/A13 grouped).

## Post-A12 domain regression

| Suite | Result | Notes |
|---|---|---|
| A12 | 13/13 PASS | reconfirmed after A3 |
| A11 | 15/15 PASS | |
| A10 | 18/18 PASS | |
| A9 | 24/24 PASS | |
| A8 | 24/24 PASS | |
| A7 | 25/25 PASS | |
| A6 | 25/25 PASS | |
| A5 | 15/15 PASS | |
| A4 | 23/23 PASS | |
| A3 | 18/18 PASS | isolated; sequential after A2 may flake `A3-31` |
| A2 | 16/16 PASS | isolated; sequential stress/`A2-16` may undercount under `createLocalOutboxPool(max:2)` |
| A1 | 39/39 PASS | isolated after RETRY_SCHEDULED vs SUCCEEDED timing flake |

Sequential A2/A3 failure signatures (when they occur) match preexisting polluted-pool / two-worker drain flake. Classification: `HARNESS_ISOLATION_FLAKE_PREEXISTING` only. `A12_CRITICAL_DOMAIN_REGRESSIONS=0`.

## Platform

- `cc:ui:test` PASS
- `ops:bff:test` PASS
- `leads:mail:test` PASS (mocked fetch; no live Resend)
- `leads:contract` PASS
- `workers:test` PASS
- `db:draft:test` PASS
- `kill:test` PASS
- `packages:boundary:check` PASS
- lint PASS
- build PASS (`NEXT_DIST_DIR=.next-a12-regression`)

## Live effects

LIVE_AI_CALLS=0 · LIVE_SOCIAL_PROVIDER_CALLS=0 · LIVE_CONTENT_PUBLICATIONS=0 · STAGING_DB_MUTATIONS=0 · PRODUCTION_DB_MUTATIONS=0 · PUSH=NO · PR=NO · MERGE=NO
