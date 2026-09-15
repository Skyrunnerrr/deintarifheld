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

Script: `scripts/rate-limit-atomic-remote.mjs`

```
ALLOW_STAGING_RATE_LIMIT_TEST=YES node scripts/rate-limit-atomic-remote.mjs
```

Without that env the script prints `RATE_LIMIT_ATOMIC_REMOTE_DB=UNKNOWN` and exits 0. Production runtime is blocked.

Prerequisites: a **staging** Supabase project with `003` + `004` + `005` applied. No production writes.

1. Confirm `LEADS_RATE_LIMIT_PROVIDER=supabase` and a dedicated staging service role.
2. The script issues 20 parallel `consume_rate_limit` calls on one unused `p_bucket_key` with `p_max_hits=5`.
3. PASS only if allowed = 5, denied = 15, `hit_count` is contiguous 1..20.
4. Print `RATE_LIMIT_ATOMIC_REMOTE_DB=PASS` only after that run. Until then keep `UNKNOWN`.

Never fail-open rate limit in production if the RPC is missing.
