# DTH-M11E-R2 — Readback + Transactional Negative Security Tests

```text
TRANCHE=DTH-M11E-R2
DATE=2026-08-13
BASELINE_HEAD=de0fe15569cd1a12fe06e870bf4fd78b1aff265a
M11E_R1B=PASS
STATUS=PASS (behavioral tests trustworthy; security gap honestly classified)
STAGING_MUTATION_PERSISTENT=NO
PRODUCTION_QUERY=NO
PRODUCTION_MUTATION=NO
OWNER_APPROVAL=APPROVE DTH-M11E-R2 STAGING TRANSACTIONAL NEGATIVE TEST ONLY
```

## Official provider position (recorded, not applied)

Supabase API security guidance recommends removing automatic API-role function grants **and** default PUBLIC function EXECUTE for explicit opt-in. PostgreSQL confirms per-schema `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM PUBLIC` does **not** neutralize builtin/global PUBLIC EXECUTE. R2 measures only; no global PUBLIC EXECUTE change was applied.

## Session / target

```text
STAGING_PROJECT_REF=uunpbmfvbfkideylhtbl
PRODUCTION_PROJECT_REF=ylvczlldcgaxyadlawtb
CURRENT_USER=postgres
SESSION_USER=postgres
MIGRATION_HASH=04c8dd4b03f840ba641f934d5e1d8bd1ebefb95854f39b1b4c21dd02f44aa4db
STAGING_HISTORY=001,002,20260813104040
```

## Private schema privilege matrix

| SCHEMA | ROLE | USAGE | CREATE |
|---|---|---|---|
| ops | anon | false | false |
| ops | authenticated | false | false |
| ops | service_role | false | false |
| ops | PUBLIC | false | false |
| security | anon/authenticated/service_role/PUBLIC | false | false |
| workflow | anon/authenticated/service_role/PUBLIC | false | false |
| audit | anon/authenticated/service_role/PUBLIC | false | false |

Owners: postgres for all four.

## Default ACL before/after test (postgres / public)

```text
objtype=r: {postgres=arwdDxtm/postgres}
objtype=S: {postgres=rwU/postgres}
objtype=f: {postgres=X/postgres}
anon/authenticated/service_role defaults: ABSENT
DEFAULT_ACL_UNCHANGED_BY_TEST=YES
```

## Existing objects

```text
EXISTING_OBJECT_HASH_BEFORE_R2=957038488bc445edce21aa9971efdb3de53e993ebc19e9b5c39c7e457e9390a6
EXISTING_OBJECT_HASH_AFTER_R2=957038488bc445edce21aa9971efdb3de53e993ebc19e9b5c39c7e457e9390a6
EXISTING_PUBLIC_OBJECTS_UNCHANGED=YES
```

## Transactional test

```text
TEST_OBJECT_COLLISIONS=NONE
BEGIN=YES
ROLLBACK=YES
TEST_OBJECT_RESIDUE_COUNT=0
MIGRATION_HISTORY_UNCHANGED=YES
SQL=scripts/security-tests/dth-m11e-r2-transactional-negative-test.sql (NON-APPLYING)
```

## Public table `__dth_m11e_r2_table`

relacl=NULL (no explicit API-role ACL entries).

Effective privileges (all FALSE for anon/authenticated/service_role):

SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER

```text
PUBLIC_TABLE_TEST=PASS
ACL_01_TABLE_DEFAULT_AUTO_GRANTS=RESOLVED
```

## Public sequence `__dth_m11e_r2_seq`

relacl=NULL. Effective USAGE/SELECT/UPDATE = FALSE for all three API roles.

```text
PUBLIC_SEQUENCE_TEST=PASS
ACL_01_SEQUENCE_DEFAULT_AUTO_GRANTS=RESOLVED
```

## Public routine `__dth_m11e_r2_fn()`

```text
EXPLICIT_ANON_EXECUTE=NO
EXPLICIT_AUTHENTICATED_EXECUTE=NO
EXPLICIT_SERVICE_ROLE_EXECUTE=NO
proacl=NULL

EFFECTIVE_ANON_EXECUTE=YES
EFFECTIVE_AUTHENTICATED_EXECUTE=YES
EFFECTIVE_SERVICE_ROLE_EXECUTE=YES
EFFECTIVE_PUBLIC_EXECUTE=YES
EFFECTIVE_EXECUTE_SOURCE=PUBLIC

PUBLIC_ROUTINE_FAIL_CLOSED=NO
PUBLIC_ROUTINE_FAIL_CLOSED_GAP=CONFIRMED
ACL_01_ROUTINE_EXPLICIT_API_GRANTS=RESOLVED
PUBLIC_ROUTINE_BUILTIN_EXECUTE=OPEN
```

## Private table `ops.__dth_m11e_r2_private_table`

```text
ops USAGE/CREATE for API roles=FALSE
object SELECT/INSERT/UPDATE/DELETE for API roles=FALSE
PRIVATE_TABLE_TEST=PASS
```

## Private routine `ops.__dth_m11e_r2_private_fn()`

```text
SCHEMA_USAGE_API_ROLES=FALSE
ROUTINE_EXECUTE_API_ROLES=TRUE (via PUBLIC)
CALL_PATH_CLASSIFICATION=OBJECT_EXECUTE_VIA_PUBLIC_BUT_BLOCKED_BY_SCHEMA_USAGE_DENY
EFFECTIVE_CALL_PATH_BLOCKED_BY_SCHEMA_BOUNDARY=SUPPORTED_BY_PRIVILEGE_MODEL
```

## ACL-01 component status

```text
ACL_01_TABLE_DEFAULT_AUTO_GRANTS=RESOLVED
ACL_01_SEQUENCE_DEFAULT_AUTO_GRANTS=RESOLVED
ACL_01_ROUTINE_EXPLICIT_API_GRANTS=RESOLVED
PUBLIC_ROUTINE_BUILTIN_EXECUTE=OPEN
ACL_01_CONFIGURATION_SCOPE_PROVEN=YES
ACL_01_CORE_API_ROLE_DEFAULTS_RESOLVED=YES
ACL_01_FULL_FAIL_CLOSED=NO
PUBLIC_ROUTINE_FAIL_CLOSED_GAP=OPEN
```

Do **not** set unqualified `ACL_01_RESOLVED=YES`.

## Data API precision

```text
API_ROLE_SCHEMA_USAGE_DENIED=YES
PRIVATE_SCHEMA_DATA_API_EXPOSURE=UNPROVEN (provider exposure list not read)
REMOTE_EXPOSED_SCHEMA_LIST=UNPROVEN
```

## Safety

```text
CUSTOMER_ROWS_QUERIED=NO
CUSTOMER_ROWS_WRITTEN=NO
PRODUCTION_QUERY=NO
PRODUCTION_MUTATION=NO
SECRET_SCAN=PASS
PII_SCAN=PASS
```

## Program implication

```text
M11E_R2=PASS
M11E=IN_PROGRESS
REASON=PUBLIC_ROUTINE_FAIL_CLOSED_GAP confirmed; R1B behaved as authored; final fail-closed for public routines requires R3 decision
RECOMMENDED_NEXT_TRANCHE=DTH-M11E-R3_PUBLIC_ROUTINE_DEFAULT_HARDENING_DECISION
```
