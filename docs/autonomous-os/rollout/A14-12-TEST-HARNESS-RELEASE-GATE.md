# A14-12 Test Harness Release Gate

## Blocker

`A14_TEST_HARNESS_ISOLATION_REQUIRED`

## Evidence (A13R)

| Suite | Isolated clean wipe | Historical sequential polluted |
|-------|---------------------|--------------------------------|
| A1 | 39/39 | flake class known |
| A2 | 16/16 ×2 | 14/16 |
| A3 | 18/18 ×2 | 17/18 |

Classification: `HARNESS_ISOLATION_FLAKE_PREEXISTING`  
`A13_CAUSED_A1_A12_REGRESSIONS=0`

## A14 requirement

Create canonical `npm run test:dth:release` (or equivalent) that:

1. Resets local disposable DB
2. Runs A1–A13 deterministically (isolated A1–A3)
3. Fails closed on material regressions

Do **not** accept flaky sequential CI as a Production gate.

Legitimate A14 work: harness isolation only — not business behavior change.
