# A1 Test Evidence

Command: `DTH_A1_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/dth_a1 npm run test:dth:a1`

Results: **39/39 PASS** (28 durable runtime + 11 failure-injection).

Local DB: Docker `dth-a1-pg` disposable. Production mutation: NO.

Regressions: boundary, workers, kill, db draft, ops-api — PASS. Lint: pre-existing Next warnings only. Build: PASS.
