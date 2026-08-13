# DTH-M11E-R3A — Public Routine Default Hardening Audit + Transactional Engine Proof

```text
TRANCHE=DTH-M11E-R3A
DATE=2026-08-13
BASELINE_HEAD=ba17dbdf8d56fe7180b5375dfd98505abc25c04a
M11E_R2=PASS
STATUS=PASS (engine proof + decision; NO persistent mutation)
PERSISTENT_DB_MUTATION=NO
PRODUCTION_QUERY=NO
PRODUCTION_MUTATION=NO
OWNER_APPROVAL=APPROVE DTH-M11E-R3A STAGING TRANSACTIONAL GLOBAL ROUTINE DEFAULT TEST ONLY
```

## Documentation precision

```text
DOCUMENTATION_EXAMPLE_SEMANTICS_MISMATCH=YES
PROVIDER_UNSUPPORTED=NO
```

Supabase security intent = explicit opt-in function access. Some Supabase examples use schema-scoped `IN SCHEMA public REVOKE EXECUTE ... FROM PUBLIC`. PostgreSQL engine semantics: that form does **not** neutralize builtin/global PUBLIC EXECUTE. DTH follows PostgreSQL for the actual control SQL.

## Candidate control (not persisted in R3A)

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
REVOKE EXECUTE ON ROUTINES FROM PUBLIC;
```

No `IN SCHEMA` clause. Scope: future routines created **as postgres** in all schemas. Rollback semantic: `GRANT EXECUTE ON ROUTINES TO PUBLIC` for role postgres (validated by full TX rollback restoring `NONE_EXPLICIT` global entry).

## Global default ACL before

```text
GLOBAL_DEFAULT_ACL_COUNT=0
POSTGRES_GLOBAL_ROUTINE_DEFAULT_ACL_BEFORE=NONE_EXPLICIT_BUILTIN_DEFAULT
postgres/public function default (schema-scoped, post-R1B)={postgres=X/postgres}
postgres/storage function defaults remain present (untouched by candidate)
```

## Routine inventory (counts)

| Schema | Owner | Count | Class |
|---|---|---|---|
| extensions | postgres | 49 | EXTENSION_OWNED |
| extensions | supabase_admin | 6 | PROVIDER_MANAGED |
| auth | supabase_auth_admin | 4 | PROVIDER_MANAGED |
| storage | supabase_storage_admin | 17 | PROVIDER_MANAGED |
| realtime | supabase_realtime_admin | 15 | PROVIDER_MANAGED |
| vault | supabase_admin | 5 | EXTENSION_OWNED |
| graphql_public | supabase_admin | 1 | PROVIDER_MANAGED |
| pgbouncer | supabase_admin | 1 | UNKNOWN/provider |

```text
DTH_OWNED_ROUTINES=0 (ops/security/workflow/audit/public app routines absent)
POSTGRES_OWNED_NON_EXTENSION_DTH=0
EXISTING_FN_ACL_HASH=3c95582e7a2bd861d13b182829401e88 (98 routines)
```

## Extension / provider assessment

```text
FUTURE_EXTENSION_CREATOR_BEHAVIOR=PARTIAL
```

Observed: pgcrypto/uuid-ossp/pg_stat_statements functions are postgres-owned today. Future `CREATE EXTENSION` as postgres would inherit the new global default unless extension scripts grant EXECUTE explicitly (common pattern). Auth/storage/realtime/vault creators use dedicated admin roles → **not** changed by `FOR ROLE postgres`.

```text
PROVIDER_FUTURE_POSTGRES_ROUTINE_CREATION_RISK=RESIDUAL_LOW_RISK
MATERIAL_UNRESOLVED_PROVIDER_RISK=NO
```

## Repository routine audit

```text
ACTIVE_GOVERNED_MIGRATION CREATE FUNCTION/PROCEDURE=NONE
ARCHIVED_REFERENCE CREATE FUNCTION=NONE
TEST_ONLY=scripts/security-tests (R2/R3A disposable)
EXPLICIT_REVOKE_PATTERNS_IN_ACTIVE_MIGRATIONS=NONE (beyond R1B API-role defaults)
EXPLICIT_GRANT_PATTERNS_IN_ACTIVE_MIGRATIONS=NONE
```

## Transactional engine proof

```text
BEGIN=YES
CANDIDATE_APPLIED_TRANSACTIONALLY=YES
ROLLBACK=YES
```

### Before control (`public.__dth_m11e_r3a_before_fn`)

```text
proacl=NULL
PUBLIC_EXECUTE=YES
ANON_EFFECTIVE_EXECUTE=YES
AUTHENTICATED_EFFECTIVE_EXECUTE=YES
SERVICE_ROLE_EFFECTIVE_EXECUTE=YES
```

### After candidate — public (`public.__dth_m11e_r3a_after_fn`)

```text
proacl={postgres=X/postgres}
PUBLIC_EXECUTE=NO
ANON_EFFECTIVE_EXECUTE=NO
AUTHENTICATED_EFFECTIVE_EXECUTE=NO
SERVICE_ROLE_EFFECTIVE_EXECUTE=NO
postgres_global_fn_defacl_after_candidate={postgres=X/postgres}
```

### After candidate — private (`ops.__dth_m11e_r3a_after_fn`)

```text
SCHEMA_USAGE_API_ROLES=NO
PUBLIC_EXECUTE=NO
API_ROLE_EFFECTIVE_EXECUTE=NO
```

### Safety inside TX

```text
EXISTING_FUNCTION_ACLS_UNCHANGED=YES (hash before==after excluding test fns)
OTHER_CREATOR_DEFAULT_ACLS_UNCHANGED=YES
```

### Post-rollback

```text
GLOBAL_ROUTINE_DEFAULT_ACL_RESTORED=YES (NONE_EXPLICIT; global_count=0)
TEST_OBJECT_RESIDUE_COUNT=0
MIGRATION_HISTORY_UNCHANGED=YES (001,002,20260813104040)
EXISTING_DTH_OBJECTS_UNCHANGED=YES
```

```text
GLOBAL_ROUTINE_DEFAULT_CONTROL_EFFECTIVE=YES
```

## Model comparison

| Option | Fail-closed | Compat | Blast radius | Operability | Secrets | M11D | Human error | Rollback | V1 complexity |
|---|---|---|---|---|---|---|---|---|---|
| A Global postgres PUBLIC EXECUTE revoke | Strong | Residual low | Creator-scoped future-only | High | None | Consistent | Low | Exact | Low |
| B Process-only private/explicit revoke | Weak | High | None | Medium | None | OK | High | N/A | Low but fragile |
| C Dedicated routine creator role | Strong | Medium | Ownership change | Low | Possible | Conflicts Model A | Medium | Harder | High |
| D Event trigger auto-revoke | Strong | Provider coupling | High | Low | None | Extra mech | Medium | Complex | High |

## Decision

```text
M11E_ROUTINE_DEFAULT_DECISION=OPTION_A_ADOPT_GLOBAL_POSTGRES_PUBLIC_EXECUTE_REVOKE
REASON=Engine-proven close of R2 gap; existing objects untouched; other creators untouched; rollback exact; residual provider risk acceptable vs process-only fragility; consistent with M11D Model A and Supabase opt-in intent
```

Accepted intentional cost: future postgres-created routines outside DTH also become EXECUTE opt-in.

## Residual risk

```text
DTH-RISK-FUNCTION-PUBLIC-EXECUTE → CLOSES after R3B/R3C apply+proof (currently OPEN pending persist)
Future CREATE EXTENSION as postgres may need explicit GRANTs if extension scripts omit them (RESIDUAL_LOW)
PRIVATE_SCHEMA_DATA_API_EXPOSURE=UNPROVEN (separate follow-up before M11E-F if practical)
ACL-02 remains M11G
```

## Next

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M11E-R3B_ROUTINE_DEFAULT_SECURITY_MIGRATION_PREAPPLY
```

R3B authors/hashes one timestamp migration containing only the approved global statement (+ transaction framing). No apply in R3A.
