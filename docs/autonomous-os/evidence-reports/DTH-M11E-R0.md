# DTH-M11E-R0 — Private Schema + Default Privilege Pre-Mutation Audit

```text
TRANCHE=DTH-M11E-R0
DATE=2026-08-13
BASELINE_HEAD=c30aff08712ceb994e03bc4c7f280813677744d2
M11D=PASS MODEL_A
STATUS=PASS (read-only)
M11E=IN_PROGRESS
STAGING_MUTATION=NO
PRODUCTION_QUERY=NO
COMMIT_CREATED=NO
```

## Migration queue

```text
STAGING_REMOTE=001,002
PRODUCTION_REMOTE=001,002 (frozen M11B)
M003_013_GOVERNED_REMOTE_APPLIED=NO
FULL_ROOT_DRY_RUN_PENDING=003–013 (proven against Staging)
MIGRATION_STRATEGY_DECISION=OPTION_C ARCHIVE/QUARANTINE 003–013 from active root
NEW_GOVERNED_MIGRATION_VERSIONING=timestamp-based
VERSION_REUSE_ALLOWED=NO
M11E_SPLIT_REQUIRED=YES → P0 queue reconciliation → R1 mutate → R2 tests → F freeze
```

## ACL-01 causal source

```text
ACL_01_CAUSAL_SOURCE=POSTGRES_PUBLIC_SCHEMA_DEFAULT
GLOBAL_DEFAULT_ACL_COUNT=0
TABLE/SEQUENCE/FUNCTION defaults for postgres are SCHEMA-scoped (public)
supabase_admin also has public schema defaults (not DTH Model A creator path)
postgres also has storage schema defaults — do not touch in M11E
```

## Private schemas

```text
ops/security/workflow/audit = ABSENT (no collisions)
OWNER_TARGET=postgres
ACCESS_TARGET=NO USAGE/CREATE for PUBLIC/anon/authenticated/service_role
intake=NOT_M11E
```

## Boundaries

```text
EXISTING_OBJECT_GRANTS=M11G
EXISTING_PUBLIC_TABLES=structurally unchanged in M11E
PROVIDER_SCHEMAS=untouched
DATA_API_EXPOSED_SCHEMAS=UNPROVEN_VIA_CLI (local config.toml lists public,graphql_public; custom schemas require explicit exposure per docs; DB USAGE deny is fail-closed baseline)
```

## Next

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M11E-P0_MIGRATION_QUEUE_RECONCILIATION
```

Do NOT create schemas or alter privileges in R0.

## M11E-P0 EXECUTION NOTE

```text
OPTION_C executed: 003–013 archived to archive/supabase-migrations/pre-m11-security/
ACTIVE root now 001,002 only. Content hashes unchanged. Remote history unchanged.
```
