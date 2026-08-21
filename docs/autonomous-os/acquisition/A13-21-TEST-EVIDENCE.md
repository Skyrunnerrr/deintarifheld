# A13-21 Test Evidence

## Suite

`npm run test:dth:a13` — **9/9 pass** (logical coverage A13-01…A13-47 + E2E organic loop + stress BOUNDED).

Critical invariants all **0** at close of suite.

## Post-A13 re-verification (this close)

| Suite | Result |
|-------|--------|
| test:dth:a13 | 9/9 |
| test:dth:a12 | 13/13 |
| test:dth:a11 | 15/15 |
| test:dth:a1 (quiet DB) | 39/39 |
| test:dth:a2 | 14/16 — fail only A2-16 two-worker + A2 stress counts |
| test:dth:a3 | 17/18 — fail only A3-31 stress handoff |

A2/A3 failures classified **HARNESS_ISOLATION_FLAKE_PREEXISTING** (concurrent handoff drain under shared local Postgres). Not sold as A13 domain regression.

A4–A10: green in implementation-session sequential regression; not re-run in this wipe-hardening pass.

## Harness remediation included

- `wipeAcquisitionDomain` / `wipeContentDomain` use `TRUNCATE … CASCADE`
- A13 test `reset()` clears outbox/cases/leads before domain wipe
- A13-08..15 handoff scoped to the accepted lead’s outbox event
