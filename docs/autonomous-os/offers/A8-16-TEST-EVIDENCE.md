# A8-16 Test evidence

`npm run test:dth:a8` → 24/24 PASS (`packages/workers/tests/a8-offer-engine.test.js`).

A7 25/25, A6 25/25, A5 15/15, A4 23/23, A3 18/18, A2 16/16, A1 39/39 (re-run after A8). Lint/build: PASS via `NEXT_DIST_DIR=.next-a8-preflight` (writable dist; `.next` EPERM is environment-only). Mail: PASS this environment (cutover gate). Boundary/kill/db/ops/workers/shared: PASS pre-implementation; recheck after.
