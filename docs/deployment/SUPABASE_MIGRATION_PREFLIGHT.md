# Supabase production migration preflight (do not execute)

```
MIGRATION_PREFLIGHT=PASS
MIGRATION_ORDER_VERIFIED=YES
MIGRATION_DESTRUCTIVE_CHANGE=NO
MIGRATION_EXECUTION_READY=NO
PRODUCTION_SCHEMA_INSPECTED=NO
PRODUCTION_BACKUP_TAKEN=NO
```

This pass **did not** connect to production Supabase and **must not** apply SQL.

## Files (binding order)

| Step | File | Depends on | What it does | Idempotent? |
|---|---|---|---|---|
| assumed present | `001_leads_phase_a.sql` | — | `leads`, `audit_events` | `IF NOT EXISTS` |
| assumed present | `002_leads_phase_b.sql` | 001 | mail columns + `career_applications`; targeted `lead_type` backfill UPDATE | additive + idempotent WHERE |
| GATE3 | `003_leads_rate_limits.sql` | 001/002 tables exist | `intake_rate_limits` + RLS + service_role grants | `CREATE TABLE IF NOT EXISTS` |
| GATE4 | `004_consume_rate_limit.sql` | 001/002 + 003 table | `anonymized_at` columns; `consume_rate_limit` as SECURITY DEFINER | `ADD COLUMN IF NOT EXISTS`; `CREATE OR REPLACE FUNCTION` |
| GATE5 | `005_legal_hold_and_rate_limit_invoker.sql` | 001/002 + 003 + 004 columns | `legal_hold` columns; **replaces** function as SECURITY INVOKER + pinned `search_path` | `ADD COLUMN IF NOT EXISTS`; `CREATE OR REPLACE FUNCTION` |

Do **not** skip 004. 005 replaces the 004 function. Applying 005 without 003 leaves a function that fails at runtime against a missing table.

## Destructive-command scan (003 / 004 / 005)

Inspected source only:

- No `DROP TABLE` of `leads` / `career_applications`
- No `TRUNCATE`
- No `UPDATE` / `DELETE` of customer rows
- `CREATE OR REPLACE FUNCTION` replaces the RPC only
- 003 rollback note (ops, not CI): `drop table public.intake_rate_limits`

`MIGRATION_DESTRUCTIVE_CHANGE=NO` for 003–005 as written.

## Locks / assumptions

- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` can take a short ACCESS EXCLUSIVE lock on `leads` / `career_applications`.
- `CREATE OR REPLACE FUNCTION` locks the function, not customer tables.
- Assumes 001/002 already exist on the target. This pass did **not** verify that.
- `consume_rate_limit` after 005 is `SECURITY INVOKER`; caller must be `service_role` (grants match 003/005).

## Binding apply runbook (ops, separately authorized)

Do not run from CI or from this PR.

1. **BACKUP/SNAPSHOT** — take a Supabase project backup/PITR snapshot. Record backup id (not secrets). Stop if backup fails.
2. **SCHEMA INSPECTION** — confirm `public.leads`, `public.career_applications`, `public.audit_events` exist. Record whether `intake_rate_limits`, `anonymized_at`, `legal_hold`, and `consume_rate_limit` already exist. Do not invent the result.
3. **003 APPLY** — apply `003_leads_rate_limits.sql` only.
4. **003 VERIFY** — `\d public.intake_rate_limits`; RLS on; no customer tables dropped.
5. **004 APPLY** — apply `004_consume_rate_limit.sql` only.
6. **004 VERIFY** — `anonymized_at` on both tables; function exists.
7. **005 APPLY** — apply `005_legal_hold_and_rate_limit_invoker.sql` only.
8. **005 VERIFY** — `legal_hold` on both tables; function `SECURITY INVOKER`; `search_path` includes `pg_catalog` first; EXECUTE revoked from PUBLIC/anon/authenticated.
9. **POST-MIGRATION CHECK** — one staging `consume_rate_limit` probe only if `ALLOW_STAGING_RATE_LIMIT_TEST=YES` and both project-ref guards match. No production probe from this PR.

`MIGRATION_EXECUTION_READY=NO` until backup + schema inspection + human authorization exist.
