# Supabase production migration preflight — COMPLETED 2026-09-15

Historical runbook retained. **Do not rerun** 003 / 004 / 005. This file no longer
authorizes a new apply.

```
MIGRATION_PREFLIGHT=PASS
MIGRATION_ORDER_VERIFIED=YES
MIGRATION_DESTRUCTIVE_CHANGE=NO
PRODUCTION_SCHEMA_INSPECTED=YES
PRODUCTION_BACKUP_TAKEN=YES
MIGRATION_003=PASS
MIGRATION_004=PASS
MIGRATION_005=PASS
MIGRATION_RERUN=NO
MIGRATION_EXECUTION_COMPLETE=YES
MIGRATION_EXECUTION_READY=NO
```

`MIGRATION_EXECUTION_READY=NO` now means **do not apply again**. Execution of
003–005 on production project `deintarifheld-phase-a` is complete.

No Supabase dashboard snapshot ID or PITR ID is recorded here. None was
invented. The verified backup method is a local custom-format `pg_dump`
taken **before** the migrations.

## Human-verified production project (2026-09-15)

- Project name: `deintarifheld-phase-a`
- Local custom-format `pg_dump` backup created before migrations
- Backup size approximately 230 KB
- `pg_restore -l` successfully read the archive TOC
- Archive had 404 TOC entries
- Schema inspection completed

### Pre-migration schema (inspected)

| Object | Before 003–005 |
|---|---|
| `public.leads` | exists |
| `public.career_applications` | exists |
| `public.audit_events` | exists |
| `public.intake_rate_limits` | absent |
| `anonymized_at` | absent |
| `legal_hold` | absent |
| `consume_rate_limit` | absent |

### Final verification (after 003–005)

| Check | Result |
|---|---|
| `intake_rate_limits` exists | PASS |
| RLS enabled | PASS |
| service_role permissions | PASS |
| primary key | PASS |
| `anonymized_at` on `leads` + `career_applications` | PASS |
| `legal_hold` on `leads` + `career_applications` | PASS |
| `consume_rate_limit` exists | PASS |
| `SECURITY INVOKER` | PASS |
| hardened `search_path` | PASS |
| anon blocked | PASS |
| authenticated blocked | PASS |
| service_role execute | PASS |

## Files (binding order) — COMPLETED

| Step | File | Status | What it did |
|---|---|---|---|
| assumed present | `001_leads_phase_a.sql` | already present | `leads`, `audit_events` |
| assumed present | `002_leads_phase_b.sql` | already present | mail columns + `career_applications` |
| GATE3 | `003_leads_rate_limits.sql` | **COMPLETED PASS** | `intake_rate_limits` + RLS + service_role grants |
| GATE4 | `004_consume_rate_limit.sql` | **COMPLETED PASS** | `anonymized_at`; initial `consume_rate_limit` |
| GATE5 | `005_legal_hold_and_rate_limit_invoker.sql` | **COMPLETED PASS** | `legal_hold`; function as SECURITY INVOKER + pinned `search_path` |

Do **not** skip 004 if this sequence is ever applied on a **new** empty project.
005 replaces the 004 function. Do **not** re-apply on `deintarifheld-phase-a`.

## Destructive-command scan (003 / 004 / 005)

Inspected source only (unchanged):

- No `DROP TABLE` of `leads` / `career_applications`
- No `TRUNCATE`
- No `UPDATE` / `DELETE` of customer rows
- `CREATE OR REPLACE FUNCTION` replaces the RPC only
- 003 rollback note (ops, not CI): `drop table public.intake_rate_limits`

`MIGRATION_DESTRUCTIVE_CHANGE=NO` for 003–005 as written.

## Historical apply runbook (COMPLETED — do not rerun)

These steps were completed on 2026-09-15. They remain as the audit trail.

1. **BACKUP — COMPLETED.** Local custom-format `pg_dump` (~230 KB). `pg_restore -l` read 404 TOC entries. No PITR/snapshot ID was recorded; do not invent one.
2. **SCHEMA INSPECTION — COMPLETED.** `public.leads`, `public.career_applications`, `public.audit_events` existed. `intake_rate_limits`, `anonymized_at`, `legal_hold`, and `consume_rate_limit` were absent before apply.
3. **003 APPLY — COMPLETED.** Do not re-apply.
4. **003 VERIFY — COMPLETED PASS.**
5. **004 APPLY — COMPLETED.** Do not re-apply.
6. **004 VERIFY — COMPLETED PASS.**
7. **005 APPLY — COMPLETED.** Do not re-apply.
8. **005 VERIFY — COMPLETED PASS.**
9. **POST-MIGRATION CHECK.** Staging `consume_rate_limit` probe remains separately authorized (`ALLOW_STAGING_RATE_LIMIT_TEST=YES` + project-ref guards). No production probe from this PR.

`MIGRATION_RERUN=NO`.
