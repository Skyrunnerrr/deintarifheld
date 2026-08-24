# M11K Trusted Database Request Context

## Result

```text
M11K_RESULT=CLOSED_E2_LOCAL_RLS_ENFORCEMENT_PENDING
TRUSTED_DB_REQUEST_CONTEXT=PROVEN_E2_LOCAL
DATABASE_RLS_HUMAN_AUTHZ=NOT_YET_COMPLETE
HOSTED_REQUEST_CONTEXT=NOT_PROVEN
```

## Question answered

After M11J authorizes a protected operator action, how is the trusted authorization context passed into PostgreSQL for the duration of the exact database transaction?

## Architecture

```text
M11J authorizeOperatorCommand
        ↓
buildTrustedDbRequestContext (server-only)
        ↓
BEGIN
        ↓
verifyOperatorAuthorityFreshness (TOCTOU)
        ↓
set_config(..., is_local=true) × 4
        ↓
domain dispatch + command log + audit (same client)
        ↓
COMMIT / ROLLBACK
        ↓
context disappears (pool-safe)
```

## Context fields (minimal)

| Key | Purpose |
|-----|---------|
| `dth.operator_id` | M11H stable human actor |
| `dth.authority_version` | M11I revision at authorization |
| `dth.required_capability` | Exact M11J capability (not full list) |
| `dth.request_id` | Correlation / idempotency trace |

Not stored: email, role, JWT, tokens, MFA, PII, full capability array.

## Trust boundary

- `buildTrustedDbRequestContext` accepts **only** `OperatorAuthzCode.AUTHORIZED` M11J results
- HTTP/client fields cannot construct trusted context
- `withAuthorizedOperatorTransaction` is the canonical protected write wrapper

## Transaction binding

- Context installed **after** `BEGIN`, **before** domain mutation
- Same `PoolClient` for install + dispatch + command log
- `SAVEPOINT m11k_operator_dispatch` isolates dispatch failures without aborting log txn
- `withControlTx` / domain helpers propagate existing client (no nested `connect()`)

## Pool isolation

Uses PostgreSQL `set_config(name, value, true)` (transaction-local).

`isPgPool()` distinguishes `pg.Pool` from `pg.PoolClient` (client has `release()`).

Proven: commit clears context, rollback clears context, max:1 pool reuse shows `NO_CONTEXT`.

## TOCTOU protection

Inside authorized transaction, `verifyOperatorAuthorityFreshness` re-reads M11I state:

- operator still active with role
- `authority_version` unchanged
- required capability still granted

Role downgrade / disable between M11J and write → `STALE_AUTHORITY` / `AUTHORITY_REVOKED` → effect=0.

## System vs human

- Operator context only for M11J-authorized human paths
- Workers/intake do not receive fake `operator_id`
- Provider dispatch remains separate system workload

## Command / audit binding

`executeOperatorCommand` stores matching:

- `operator_id`, `authority_version`, `required_capability`, `correlation_id`

on `ops.operator_commands` and successful-command audit events.

## M11L/M handoff

M11K exposes `readCurrentOperatorRequestContext(client)` for future RLS helpers:

- `current_setting('dth.operator_id', true)` etc.
- M11L/M implement database-enforced policies; M11K does **not** claim full DB human AuthZ

## Security honesty

| Claim | Status |
|-------|--------|
| TRUSTED_DB_REQUEST_CONTEXT | PROVEN_E2_LOCAL |
| TRANSACTION_LOCAL_CONTEXT | PROVEN_E2_LOCAL |
| POOL_CONTEXT_ISOLATION | PROVEN_E2_LOCAL |
| AUTHORITY_TOCTOU_PROTECTION | PROVEN_E2_LOCAL |
| DATABASE_RLS_HUMAN_AUTHZ | NOT_YET_COMPLETE |
| HOSTED_REQUEST_CONTEXT | NOT_PROVEN |

Compromised `dth_ops_api` server could still attempt context forgery until M11L/M DB policies constrain it.

## Local proof

`npm run test:dth:m11k` → **14/14 PASS**
