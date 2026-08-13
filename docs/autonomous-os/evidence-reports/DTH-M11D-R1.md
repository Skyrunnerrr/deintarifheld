# DTH-M11D-R1 — Model A Freeze + Migration Custody Foundation

```text
TRANCHE=DTH-M11D-R1
DATE=2026-08-13
BASELINE_BEFORE=d4645c28b47b8259ee03eb84131650699e50572b
M11D_R0=PASS
M11D_MODEL_DECISION=MODEL_A
STATUS=PASS (post-commit gates)
DB_MUTATION=NO
NEW_DDL_OWNER_CREATED=NO
NEW_MIGRATION_LOGIN_CREATED=NO
NEW_DB_SECRET_CREATED=NO
```

## Model A

```text
DDL_AUTHORITY_V1=postgres
NORMAL_DTH_OBJECT_OWNER=postgres
RUNTIME_MUST_NOT_OWN_OBJECTS=YES
RUNTIME_AUTHORITY != MIGRATION_AUTHORITY
CUSTOM_OWNER != POSTGRES is NOT required for V1
```

## Evidence precision

```text
CURRENT_LINKED_DB_EFFECTIVE_PRINCIPAL=postgres
DB_PUSH_EXECUTOR_MODEL=POSTGRES_ADMIN_PATH_SUPPORTED_BY_PROVIDER_AND_EXISTING_LINKED_EVIDENCE
DIRECT_DB_PUSH_SESSION_INSTRUMENTATION=NOT_SEPARATELY_CAPTURED
```

## Provider DO_NOT_MODIFY

postgres, anon, authenticated, authenticator, service_role, dashboard_user,
supabase_admin, supabase_auth_admin, supabase_storage_admin, supabase_etl_admin,
supabase_privileged_role, supabase_read_only_user, supabase_realtime_admin,
supabase_replication_admin, cli_login_postgres

(+ later-discovered provider/system roles)

## Ownership / custody contracts

```text
CANONICAL_MIGRATION_ROOT=supabase/migrations/
packages/db=NON_CANONICAL_DESIGN_DRAFT
MIGRATION_RUNNER_V1=OWNER_CONTROLLED_SUPABASE_ADMIN_PATH
NEW_LOGIN_ROLE=NO
NEW_DB_SECRET=NO
DB_MIGRATION_CI=NOT_IMPLEMENTED
EXECUTABLE_MIGRATION_GUARD=DEFERRED_UNTIL_CI_OR_CANONICAL_RUNNER_EXISTS
NOTE=scripts/infra/phase-a/apply.sh is historical Phase-A bootstrap (defaults to deintarifheld-phase-a); NOT the M11D custody runner; do not use for Staging security migrations without dedicated future tranche.
```

## Gates

```text
PRODUCTION_DB_MUTATION_DEFAULT=DENY
ALL_SECURITY_MIGRATIONS_STAGING_FIRST=YES
M001_IMMUTABLE=YES
M002_IMMUTABLE=YES
M11E_DEFAULT_PRIVILEGE_OWNER_PRINCIPAL=postgres
SERVICE_ROLE_IS_NOT_MIGRATION_AUTHORITY=YES
SERVICE_ROLE_IS_NOT_DDL_AUTHORITY=YES
SERVICE_ROLE_RUNTIME_DEBT=OPEN
```

## Process vs technical

```text
PROCESS_CONTROL=STRONG (governance gates, staging-first, target verify, Owner custody)
TECHNICAL_ENFORCEMENT_CURRENT=LIMITED (postgres credential holders can still execute SQL)
FUTURE_TECHNICAL_ENFORCEMENT=CI + credential isolation + runtime DB roles (M11F+)
```

## Reconsideration triggers (Model B/D)

DB_MIGRATION_CI_IMPLEMENTED / MULTIPLE_HUMAN_DB_OPERATORS /
POSTGRES_CREDENTIAL_DISTRIBUTION_RISK_INCREASES /
AUDIT_REQUIREMENT_REQUIRES_DEDICATED_LOGIN /
PROVIDER_SUPPORT_FOR_CUSTOM_OWNER_IS_PROVEN /
OPERATIONAL_NEED_JUSTIFIES_COMPLEXITY

## Runtime hard boundaries (future M11F)

dth_public_intake / dth_ops_api / dth_worker:
LOGIN=YES; CREATEROLE/CREATEDB/SUPERUSER/BYPASSRLS/OWNER/DDL=NO

## Next

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M11E_PRIVATE_SCHEMA_AND_DEFAULT_PRIVILEGES
```

Do NOT start M11E in this tranche.
