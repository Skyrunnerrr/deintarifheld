# A3-09 Failure / Concurrency

- Pre-commit FI: rollback, no partial rows
- Observation unique idempotency_key
- Concurrent observations preserved; re-eval converges
- Global kill: A1 claim gate; no lost jobs
