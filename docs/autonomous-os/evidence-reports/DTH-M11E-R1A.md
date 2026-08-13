# DTH-M11E-R1A — Security Migration Authoring + Pre-Apply Freeze

```text
TRANCHE=DTH-M11E-R1A
DATE=2026-08-13
BASELINE_HEAD=b2c1f9ee619273927938d18d99ce527a036568cd
M11E_P0=PASS
STATUS=PASS (pre-apply freeze; no remote mutation)
STAGING_MUTATION=NO
PRODUCTION_QUERY=NO
PRODUCTION_MUTATION=NO
```

## Migration identity (R1B authorization binding)

```text
MIGRATION_VERSION=20260813104040
MIGRATION_FILE=supabase/migrations/20260813104040_m11e_private_schema_default_privileges.sql
M11E_R1_MIGRATION_SHA256=04c8dd4b03f840ba641f934d5e1d8bd1ebefb95854f39b1b4c21dd02f44aa4db
MIGRATION_VERSION_UNIQUE=PASS
AUTHORIZED_ENVIRONMENT=STAGING
AUTHORIZED_PROJECT_REF=uunpbmfvbfkideylhtbl
```

Any byte change after this freeze voids R1B authorization until a new R1A cycle.

## Statement inventory (normalized)

Allowed classes only: `BEGIN` / `COMMIT` / `CREATE SCHEMA` / `REVOKE ON SCHEMA` / `ALTER DEFAULT PRIVILEGES`.

```text
CREATE_SCHEMA_STATEMENTS=4
  CREATE SCHEMA ops AUTHORIZATION postgres
  CREATE SCHEMA security AUTHORIZATION postgres
  CREATE SCHEMA workflow AUTHORIZATION postgres
  CREATE SCHEMA audit AUTHORIZATION postgres

SCHEMA_REVOKE_STATEMENTS=8
  REVOKE ALL ON SCHEMA {ops,security,workflow,audit} FROM PUBLIC  (×4)
  REVOKE USAGE, CREATE ON SCHEMA {ops,security,workflow,audit} FROM anon, authenticated, service_role  (×4)

ALTER_DEFAULT_PRIVILEGE_STATEMENTS=3
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, service_role
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON ROUTINES FROM anon, authenticated, service_role

OTHER_MUTATION_STATEMENTS=0
PROVIDER_SCHEMA_MUTATION_REFERENCE_COUNT=0
SUPABASE_ADMIN_DEFAULT_ACL_MUTATION=NO
GLOBAL_PUBLIC_ROUTINE_EXECUTE_CHANGE=NO
GLOBAL_TYPE_USAGE_CHANGE=NO
EXISTING_OBJECT_GRANT_SQL=NONE
CASCADE=NO
IF_NOT_EXISTS=NO
STATIC_SQL_REVIEW=PASS
```

Schemas referenced by privilege-changing statements: `public`, `ops`, `security`, `workflow`, `audit`.

## Design freezes (non-SQL)

```text
DTH_ROUTINES_IN_PUBLIC_BY_DEFAULT=FORBIDDEN
FUNCTION_PUBLIC_EXECUTE_DEFAULT=CONTROLLED_BY_DTH_SCHEMA_BOUNDARY_AND_EXPLICIT_OBJECT_REVIEW
GLOBAL_POSTGRES_PUBLIC_ROUTINE_DEFAULT_REVOKE=DEFER
DTH_TYPES_IN_PUBLIC_BY_DEFAULT=DISCOURAGED / EXPLICIT_REVIEW_REQUIRED
PRIVATE_SCHEMA_DB_ACCESS_FOR_API_ROLES=DENIED (intended after R1B)
PRIVATE_SCHEMA_DATA_API_TARGET=NOT_EXPOSED (target; not provider-proven in R1A)
REMOTE_DATA_API_EXPOSURE_READBACK=PENDING
```

## R0 assumption revalidation (SELECT-only Staging)

```text
PRIVATE_SCHEMA_COLLISIONS=NONE (ops/security/workflow/audit/intake absent)
ACL_01_CAUSAL_SOURCE=POSTGRES_PUBLIC_SCHEMA_DEFAULT (unchanged)
GLOBAL_DEFAULT_ACL_COUNT=0
PUBLIC_SCHEMA_OWNER=pg_database_owner
EXISTING_TABLE_OWNERS=postgres (leads, career_applications, audit_events)
EXISTING_POLICY_COUNT=0 (all three)
ROW_COUNTS=0/0/0
STAGING_ASSUMPTIONS_REVALIDATED=PASS
```

Captured pre-apply postgres/public default ACL (for rollback fidelity):

```text
objtype=r TABLES:    {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
objtype=S SEQUENCES: {postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}
objtype=f FUNCTIONS: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

## Staging dry-run (isolated workdir)

```text
ISOLATED_WORKDIR=/tmp/dth-m11e-r1a-dry-Iez3Ff
LINKED_PROJECT_REF=uunpbmfvbfkideylhtbl
ACTUAL!=PRODUCTION=YES
STAGING_HISTORY_BEFORE=001,002 remote; 20260813104040 local-only; 003–013 ABSENT
PENDING_MIGRATION_COUNT=1
PENDING_MIGRATIONS=20260813104040_m11e_private_schema_default_privileges.sql
HAS_003_013=NO
HAS_DRAFTS=NO
HAS_SEED=NO
STAGING_DRY_RUN=PASS
db push (actual)=NOT_EXECUTED
```

## Expected security delta (after R1B only)

```text
SCHEMAS_CREATED=ops,security,workflow,audit
PRIVATE_SCHEMA_API_ROLE_USAGE=NO
PRIVATE_SCHEMA_API_ROLE_CREATE=NO
POSTGRES_PUBLIC_TABLE_DEFAULT_API_GRANTS=NONE
POSTGRES_PUBLIC_SEQUENCE_DEFAULT_API_GRANTS=NONE
POSTGRES_PUBLIC_ROUTINE_EXPLICIT_API_GRANTS=NONE
EXISTING_PUBLIC_TABLE_GRANTS=UNCHANGED
POSTGRES_BUILTIN_PUBLIC_ROUTINE_EXECUTE=NOT_GLOBALLY_CHANGED
```

ACL-01 resolution requires R1B/R2 proof; R1A only freezes the migration that will implement it.

## Rollback procedure (manual; not an active migration)

Do **not** auto-apply. Restore only if schemas remain empty and no later migration depends on them.

1. Restore captured postgres/public default privileges (exact prior evidence):

```sql
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON ROUTINES TO anon, authenticated, service_role;
-- Then verify pg_default_acl matches captured pre-apply strings above.
-- If mismatch: STOP; do not DROP schemas until defaults match evidence.
COMMIT;
```

2. Drop empty private schemas (no CASCADE):

```sql
BEGIN;
DROP SCHEMA ops;
DROP SCHEMA security;
DROP SCHEMA workflow;
DROP SCHEMA audit;
COMMIT;
```

```text
ROLLBACK_PLAN=PASS
TRANSACTIONAL_MIGRATION=YES (BEGIN/COMMIT; expectation documented; not R1A-proven under apply failure)
APPLY_FAILURE_PLAN=STOPPED_SAFE; no repair / manual completion / blind retry
```

## Hygiene

```text
SECRET_SCAN=PASS
PII_SCAN=PASS
LOCAL_EXECUTION_VALIDATION=UNAVAILABLE
DIFF_SCOPE=migration + R1A evidence/governance only
APPLICATION_SOURCE_CHANGED=NO
RUNTIME_CONFIG_CHANGED=NO
ARCHIVE_003_013_HASHES=UNCHANGED
```

## Risks / controls

```text
DTH-RISK-FUNCTION-PUBLIC-EXECUTE=OPEN (deferred global revoke; mitigated by private schema USAGE deny + no public DTH routines by default)
DTH-RISK-TYPE-PUBLIC-USAGE=OPEN_LOW (no global type default change; prefer private schemas)
ACL-01=IMPLEMENTATION_FROZEN_PENDING_R1B_R2
ACL-02=UNTOUCHED (M11G)
```

## Next

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M11E-R1B_STAGING_SECURITY_MIGRATION_APPLY
R1B may apply ONLY the authorized SHA256 above to Staging project uunpbmfvbfkideylhtbl.
```
