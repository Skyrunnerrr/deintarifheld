# Rate-limit atomicity — code vs remote DB

```
RATE_LIMIT_ATOMIC_CODE=PASS
RATE_LIMIT_ATOMIC_REMOTE_DB=UNKNOWN
PRODUCTION_DATA_MUTATED=NO
```

Unit tests prove:

- in-process memory consume is a single critical section (no await)
- application code calls one `consume_rate_limit` RPC per consume
- migration `005` defines that RPC as `SECURITY INVOKER` with `search_path = pg_catalog, public, pg_temp` and EXECUTE revoked from PUBLIC/anon/authenticated

They **mock** `.rpc()`. They do **not** prove a real Postgres `ON CONFLICT` increment under parallel clients.

## Staging parallel test (ops, not CI, not production)

Prerequisites: a **staging** Supabase project with `003` + `004` + `005` applied. No production writes.

1. Confirm `LEADS_RATE_LIMIT_PROVIDER=supabase` and a dedicated staging service role.
2. From two or more concurrent clients, call `consume_rate_limit` 20+ times on one unused `p_bucket_key` with `p_max_hits=5`.
3. PASS only if allowed rows = 5, `hit_count` is contiguous 1..N, and no lost updates.
4. Print `RATE_LIMIT_ATOMIC_REMOTE_DB=PASS` only after that run. Until then keep `UNKNOWN`.

Never fail-open rate limit in production if the RPC is missing.
