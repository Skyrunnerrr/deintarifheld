# @deintarifheld/workers

P3-F5 fail-closed local **one-shot** worker stub.

## Defaults

- `AUTOMATION_ACTIVATION=NO`
- No continuous polling, scheduler, cron, retry engine, or dead-letter
- No mail / external HTTP
- Consumes existing `transactional_outbox` only (F2b table; F3 remains canonical writer)

## Positive test path (only)

Requires all of: `RUNTIME_ENVIRONMENT=TEST`, explicit local test flag, `AUTOMATION_ACTIVATION=YES`, `AUTOMATION_ENGINE` kill `INACTIVE` (in-memory test fixture), disposable local DB, synthetic event `DTH_LOCAL_TEST_NOOP`, DENY_ALL effects.

Processes **at most one** synthetic row and updates outbox bookkeeping fields only.
