# DTH-M11B — Production Migration State Reconciliation — Final

```text
TRANCHE=DTH-M11B
DATE=2026-08-13
BASELINE_HEAD=c3b26a4f6e3c53b76c5bb71099f6900c5824fae8
STATUS=PASS
PRODUCTION_MIGRATION_STATE=PROVEN
PROD_DB_BASELINE_ID=DTH-PROD-DB-20260813-de5e6bd1ecf4
MIGRATION_HISTORY_HASH=3164aeb0f4d85eabb8bcc255402e83170729ffe8cb076483b98caf2407eca512
SCHEMA_FINGERPRINT_HASH=de5e6bd1ecf430f620c95f914cf4f89f38e55cbf94058292bc34b4d98af77fb4
COMMIT_AUTHORIZED=NO
M11C_AUTHORIZED=NO
```

## 1. Owner Readback

```text
OWNER_PROJECT_CONFIRMATION=YES
PROJECT=deintarifheld-phase-a / PRODUCTION
READBACK_EXECUTED=YES (Owner SQL Editor SELECT-only)
CUSTOMER_ROWS_QUERIED=NO
MUTATION_EXECUTED=NO
CURSOR_EXECUTED_REMOTE_SQL=NO
```

## 2. Migration History

```text
REMOTE: 001=YES, 002=YES, 003–013=NO
Dashboard LAST_MIGRATION=leads_phase_b (supporting only)
```

## 3. Production Schema Baseline

```text
SCHEMAS: public + supabase_migrations only
TARGET private schemas intake/ops/security/workflow/audit: ABSENT
TABLES: public.leads, public.career_applications, public.audit_events
OPS LOCAL TABLES: NONE
TRIGGERS: NONE
```

## 4. Migration 001

```text
M001_HISTORY=YES
M001_SCHEMA=MATCH (leads+audit_events columns/indexes/RLS; status_check implied as 11th constraint)
M001_SECURITY_STATE=RLS_ENABLED policies=0 FORCE=false
M001_RECONCILED=PASS
```

## 5. Migration 002

```text
M002_COMMENT_CONFLICT=YES (stale "remote apply forbidden" header)
M002_EXECUTABLE_INTENT=additive lead_type/mail_* + career_applications + career_id FK/index + service_role grants
M002_REMOTE_HISTORY=YES
M002_ACTUAL_SCHEMA=MATCH (columns/indexes exact; career RLS enabled)
M002_SECURITY_STATE=service_role grants present-class + RLS enabled policies=0
M002_RECONCILED=PASS
CLASSIFICATION=DOCUMENTATION_DISCREPANCY (comment), not SCHEMA_DRIFT
```

## 6. Migrations 003–013

All EXPECTED_PRODUCTION=NO; REMOTE_HISTORY=NO; EXPECTED_OBJECTS_PRESENT=NO → RESULT=PASS each.
003 creates no persistent tables (reference/markers only) — consistent with absence.

## 7. RLS / Policy

```text
RLS_ENABLED=true (leads, career_applications, audit_events)
FORCE_RLS=false
POLICY_COUNT=0
```

## 8. Ownership

```text
TABLE_OWNER=postgres (all three)
TARGET_OWNER_MODEL=DDL/migration owner ≠ runtime (M10) → CHANGE_REQUIRED_LATER=YES (M11D/E)
```

## 9. Roles

```text
anon BYPASSRLS=false
authenticated BYPASSRLS=false
service_role BYPASSRLS=true
dth_*=NONE
CURRENT_DTH_RUNTIME_LOGIN_ROLES=NOT_IMPLEMENTED
```

## 10–11. ACL Findings (legacy, not drift)

```text
M11B-ACL-01=public default privileges broad for anon/authenticated → M11E input
M11B-ACL-02=broad table grants to anon/authenticated/service_role → M11G input
KNOWN_LEGACY_SECURITY_STATE=YES
Nuance: anon/authenticated lack BYPASSRLS + RLS on + 0 policies ⇒ row path default-deny for those roles; service_role bypasses RLS (current public API path).
```

## 12. Drift

```text
REMOTE_DRIFT_CLASS=NO_DRIFT_OBSERVED
MATERIAL_UNEXPLAINED_DRIFT=NO
```

Indexes: 16/16 match 001+002 named indexes. Columns: exact match. Constraints: 11 = expected set including leads_status_check (screenshot listed 10 names + one cropped).

## 13. Certainty / Baseline

```text
PRODUCTION_MIGRATION_STATE=PROVEN
PROD_DB_BASELINE_ID=DTH-PROD-DB-20260813-de5e6bd1ecf4
```

## 14. M11A Reconciliation

Assumptions confirmed: 001–002 spine; 003–013 absent; RLS on; policies 0; FORCE false; postgres owner; service_role bypass; no dth_*; hybrid schema still valid; M11E/M11G priority reinforced by ACL-01/02.

## 15. Safety

```text
DB_MUTATION=NO
NO further Production SQL after R1
SECRET_EXPOSURE=NO
PII_EXPOSURE=NO
```

## 16. Gate

```text
M11B=PASS
REASON=Owner-assisted metadata proves 001/002 history+schema match Git executable intent; 003–013 absent; no unexplained drift; ACL findings classified as known legacy hardening inputs.
```

## 17. Next

```text
RECOMMENDED_NEXT_ACTION=OWNER_REVIEW_AND_FREEZE_M11A_M11B_BEFORE_M11C
```

## M11ABF FREEZE NOTE

```text
M11B=PASS frozen with DTH-M11ABF.
PERSISTENT_RAW_EVIDENCE_LOCATION=DEGRADED_WORKSPACE_GITIGNORED (limitation preserved; not claimed as full raw archive).
NORMALIZED_METADATA=canonical committable evidence.
```
