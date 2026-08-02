# P3-F5 — Existing-outbox consumer and local worker stub

## Ownership

| Concern | Owner |
|---|---|
| `transactional_outbox` table | P3-F2b |
| Canonical transactional outbox writer | P3-F3 |
| Consumer + one-shot worker stub | P3-F5 |

## Hard defaults

- `AUTOMATION_ACTIVATION=NO`
- Missing/invalid/unknown config → NO
- `WORKER_EXECUTION_MODE=ONE_SHOT_EXPLICIT_LOCAL_TEST_ONLY`
- Continuous polling / scheduling / retry / dead-letter = NO

## Synthetic event

`DTH_LOCAL_TEST_NOOP` with payload `{ "test": true, "operation": "NOOP" }` only.

## Kill posture

Normal tests keep `AUTOMATION_ENGINE=ACTIVE` (blocks processing).  
Positive path may override kill to `INACTIVE` in a non-persistent in-memory fixture only.

## Success token

`READY_FOR_NOAH_P3_F5_REVIEW`
