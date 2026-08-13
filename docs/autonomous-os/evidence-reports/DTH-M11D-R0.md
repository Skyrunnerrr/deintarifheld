# DTH-M11D-R0 — DDL Ownership + Migration Custody Audit

```text
TRANCHE=DTH-M11D-R0
DATE=2026-08-13
BASELINE_HEAD=d4645c28b47b8259ee03eb84131650699e50572b
M11CF=PASS
STATUS=PASS (read-only audit)
M11D=IN_PROGRESS
STAGING_MUTATION=NO
PRODUCTION_QUERY=NO
COMMIT_CREATED=NO
```

## Target

```text
STAGING_PROJECT_REF=uunpbmfvbfkideylhtbl
PRODUCTION_PROJECT_REF=ylvczlldcgaxyadlawtb
```

## Session / migration executor (precision)

```text
LINKED_QUERY_CURRENT_USER=postgres
LINKED_QUERY_SESSION_USER=postgres
CURRENT_LINKED_DB_EFFECTIVE_PRINCIPAL=postgres
DB_PUSH_EXECUTOR_MODEL=POSTGRES_ADMIN_PATH_SUPPORTED_BY_PROVIDER_AND_EXISTING_LINKED_EVIDENCE
DIRECT_DB_PUSH_SESSION_INSTRUMENTATION=NOT_SEPARATELY_CAPTURED
CLI_NOTE=CLI emits Initialising login role; membership includes cli_login_postgres → postgres
cli_login_postgres: LOGIN=true INHERIT=false CREATEROLE=false SUPER=false BYPASSRLS=false — DO_NOT_MODIFY
DEPRECATED_OVERCLAIM=CURRENT_MIGRATION_EXECUTOR=postgres (too strong; refined above)
```

## Ownership baseline

```text
PUBLIC_SCHEMA_OWNER=pg_database_owner
LEADS_OWNER=postgres
CAREER_APPLICATIONS_OWNER=postgres
AUDIT_EVENTS_OWNER=postgres
MIGRATION_SCHEMA_OWNER=postgres
MIGRATION_HISTORY_TABLE_OWNER=postgres
```

Provider schemas (owners): auth/storage/realtime/graphql/graphql_public/vault → supabase_admin; extensions/supabase_migrations → postgres; public → pg_database_owner.

## Postgres observed authority

```text
LOGIN=true SUPERUSER=false CREATEROLE=true CREATEDB=true BYPASSRLS=true REPLICATION=true
is_superuser setting=off
```

## Model decision (recommended for Owner review)

```text
M11D_MODEL_DECISION=MODEL_A
POSTGRES_AS_DDL_OWNER
```

Reason: current objects already postgres-owned; CLI db push proven as postgres; custom owner CONDITIONAL on GRANT custom_role TO postgres (provider docs); no migration CI yet so new LOGIN secret adds complexity without value; runtime separation remains via future M11F roles that never own/migrate.

## Custom owner compatibility

```text
CUSTOM_OWNER_REQUIRES_POSTGRES_MEMBERSHIP=YES
CURRENT_DB_PUSH_COMPATIBLE_WITH_CUSTOM_OWNER=CONDITIONAL
Condition=postgres (migration executor) must be granted membership in custom owner role, else 42501 on db push
```

## CI / secrets

```text
DB_MIGRATION_CI_EXISTS=NO
NEW_MIGRATION_LOGIN_REQUIRED=NO (for Model A)
NEW_SECRET_REQUIRED=NO (for Model A)
```

## Collisions

```text
dth_ddl_owner / dth_migration_runner / dth_public_intake / dth_ops_api / dth_worker = ABSENT
```

## Safety

```text
STAGING_DB_MUTATION=NO
STAGING_ROLE_MUTATION=NO
PRODUCTION_QUERY=NO
CUSTOMER_ROWS_QUERIED=NO
```

## Next

```text
RECOMMENDED_NEXT_ACTION=OWNER_REVIEW_M11D_MODEL_THEN_M11D_R1_MINIMAL_STAGING_IMPLEMENTATION
```

Do NOT create roles in R0.

## M11D-R1 PRECISION NOTE

```text
Refined executor claim: linked query principal proven postgres; db push transaction not separately instrumented.
Model A remains supported by ownership + provider docs + linked administrative path evidence.
```
