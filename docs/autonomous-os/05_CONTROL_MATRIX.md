# 05 — Control Matrix

TRANCHE=DTH-M9F  
ARCHITECTURE_FREEZE=YES  
NOTE=Architecture acceptance ≠ implementation PASS.

Legend columns:
ARCHITECTURE_DECIDED | IMPLEMENTED | LOCAL_EVIDENCE | STAGING_EVIDENCE | PRODUCTION_EVIDENCE

| Control | ARCHITECTURE_DECIDED | IMPLEMENTED | LOCAL_EVIDENCE | STAGING_EVIDENCE | PRODUCTION_EVIDENCE |
|---|---|---|---|---|---|
| Dual-plane Evolutionary (DTH-ERA-A) | PASS | PARTIAL (public LIVE; Ops LOCAL) | PASS (M8C/M9) | NOT_APPLICABLE_YET | PARTIAL (public only) |
| Canonical public = root Next | PASS | PASS (prod public) | PASS | NOT_APPLICABLE_YET | PASS |
| Canonical Ops packages | PASS | PARTIAL (local packages) | PASS | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| packages/web+api deprecation candidates | PASS | NOT_DELETED (intentional) | PASS | NOT_APPLICABLE | NOT_APPLICABLE |
| Durable public→Ops handoff | PASS (topology M10) | NOT_IMPLEMENTED (target) | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| No browser/agent→DB | PASS | PARTIAL | PASS | NOT_IMPLEMENTED | PARTIAL |
| Credential boundary / no general service_role target | PASS | NOT_IMPLEMENTED (current broad service_role) | PASS (docs) | NOT_IMPLEMENTED | FAIL_CURRENT_STATE |
| Durable session registry (Postgres) | PASS | NOT_IMPLEMENTED (in-memory today) | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Durable kill switch (Postgres) | PASS | NOT_IMPLEMENTED (in-memory today) | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Workflow Postgres+worker V1 | PASS | NOT_IMPLEMENTED | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Outbox before provider | PASS | PARTIAL/UNKNOWN | PASS (docs) | NOT_IMPLEMENTED | UNKNOWN |
| Last-mile control check | PASS | NOT_IMPLEMENTED | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Stale-execution invalidation | PASS | NOT_IMPLEMENTED | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Agent tool boundary | PASS | NOT_IMPLEMENTED | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Audit append-only-for-runtime | PASS | NOT_IMPLEMENTED | PASS (docs) | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Environment isolation model | PASS | PARTIAL | PASS | NOT_IMPLEMENTED (no staging) | PARTIAL |
| Strong AuthZ | PASS (required) | NOT_IMPLEMENTED | FAIL | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| RLS policies | PASS (required) | NOT_IMPLEMENTED (ENABLE only) | FAIL | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Persistent person mapping | PASS (required) | NOT_IMPLEMENTED | FAIL | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| M6 identity evidence closure | OPEN (Track A) | N/A | OPEN | N/A | OPEN |

## Explicit architecture vs implementation pairs

```text
DURABLE_KILL_SWITCH_ARCHITECTURE=PASS
DURABLE_KILL_SWITCH_IMPLEMENTATION=NOT_IMPLEMENTED

DURABLE_SESSION_REGISTRY_ARCHITECTURE=PASS
DURABLE_SESSION_REGISTRY_IMPLEMENTATION=NOT_IMPLEMENTED

WORKFLOW_RUNTIME_ARCHITECTURE=PASS
WORKFLOW_RUNTIME_IMPLEMENTATION=NOT_IMPLEMENTED

SERVICE_ROLE_MINIMIZATION_ARCHITECTURE=PASS
SERVICE_ROLE_MINIMIZATION_IMPLEMENTATION=NOT_IMPLEMENTED

LAST_MILE_CONTROL_ARCHITECTURE=PASS
LAST_MILE_CONTROL_IMPLEMENTATION=NOT_IMPLEMENTED

STALE_EXECUTION_ARCHITECTURE=PASS
STALE_EXECUTION_IMPLEMENTATION=NOT_IMPLEMENTED
```

## M6 preservation

```text
M6=OPEN
OWNER_READBACK_PENDING=YES
BLOCKING_CLASS=BLOCKING_BEFORE_PRODUCTION_IDENTITY_CLOSURE
```

## M10 Data Architecture Controls

| Control | ARCHITECTURE_DECIDED | IMPLEMENTED |
|---|---|---|
| DATA_TOPOLOGY DTH-DT-A | PASS | NOT_IMPLEMENTED (topology choice only) |
| PUBLIC_INTAKE role target | PASS | NOT_IMPLEMENTED |
| service_role retirement design | PASS | NOT_IMPLEMENTED |
| Grants/RLS/App AuthZ layers | PASS | NOT_IMPLEMENTED |
| SoT registry | PASS | PARTIAL (leads live; Ops local) |
| CONTROL_VERSION persistence | PASS | NOT_IMPLEMENTED |
| Durable session/kill/workflow data | PASS | NOT_IMPLEMENTED |
| Retention/deletion graph | PASS | PARTIAL (cron soft-delete exists; graph incomplete) |
| Migration authority supabase/migrations | PASS | PROCESS (drafts still present DO_NOT_APPLY) |

## M10R Controls

| Control | ARCHITECTURE_DECIDED | IMPLEMENTED |
|---|---|---|
| DIRECT_POSTGRES_LOGIN_ROLE assumption | PASS | NOT_IMPLEMENTED |
| Physical private schemas ops/security/workflow/audit | PASS | NOT_IMPLEMENTED |
| PUBLIC_INTAKE without service_role | PASS | NOT_IMPLEMENTED |
| Server atomic intake transaction | PASS | NOT_IMPLEMENTED |
| Request-scoped human DB context | PASS | NOT_IMPLEMENTED |
| OPERATOR_PERSON ≠ EXTERNAL_PARTY | PASS | NOT_IMPLEMENTED |
| Same-txn security audit | PASS | NOT_IMPLEMENTED |
| Post-restore privacy reconcile | PASS | NOT_IMPLEMENTED |

## M10F Architecture vs Implementation

| Control | ARCHITECTURE_DECIDED | IMPLEMENTED |
|---|---|---|
| DATA_TOPOLOGY DTH-DT-A physically segmented | PASS | NOT_IMPLEMENTED |
| PUBLIC_INTAKE_ROLE (direct LOGIN) | PASS | NOT_IMPLEMENTED |
| PHYSICAL_PRIVATE_SCHEMAS ops/security/workflow/audit | PASS | NOT_IMPLEMENTED |
| DATA_API_EXPOSED=NO for internal domains | PASS | NOT_IMPLEMENTED |
| RUNTIME_ROLE_MUST_NOT_OWN_PROTECTED_TABLE | PASS | NOT_IMPLEMENTED |
| NORMAL_RUNTIME BYPASSRLS=NO | PASS | NOT_IMPLEMENTED (legacy service_role still present) |
| SERVER_DIRECT_POSTGRES_TRANSACTION intake | PASS | NOT_IMPLEMENTED |
| OPS_API_SET_REQUEST_SCOPED_DB_CONTEXT | PASS | NOT_IMPLEMENTED |
| OPERATOR_PERSON ≠ EXTERNAL_PARTY | PASS | NOT_IMPLEMENTED |
| CONTROL_VERSION / durable kill/session | PASS | NOT_IMPLEMENTED |
| SAME_TXN security audit | PASS | NOT_IMPLEMENTED |
| POST_RESTORE privacy reconcile | PASS | NOT_IMPLEMENTED |
| Migration authority supabase/migrations | PASS | PROCESS |
| RLS policies | PASS (architecture) | NOT_IMPLEMENTED |
| Strong App AuthZ | PASS (required) | NOT_IMPLEMENTED |

