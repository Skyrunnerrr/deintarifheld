# M11M Full Business Data-Scope RLS

## Result

```text
M11M_RESULT=CLOSED_E2_LOCAL_BUSINESS_DATA_RLS_PROVEN
FULL_DATA_SCOPE_RLS=PROVEN_E2_LOCAL
BUSINESS_DOMAIN_RLS=PROVEN_E2_LOCAL
OPERATOR_BUSINESS_DATA_ENFORCEMENT=PROVEN_E2_LOCAL
WORKER_DATA_SCOPE_ENFORCEMENT=PROVEN_E2_LOCAL
PUBLIC_INTAKE_DATA_SCOPE_ENFORCEMENT=PROVEN_E2_LOCAL
CROSS_DOMAIN_PRIVILEGE_ISOLATION=PROVEN_E2_LOCAL
RUNTIME_DATABASE_IDENTITY_ALIGNMENT=EXPLICIT_LATER_GATE
DATABASE_RLS_HUMAN_AUTHZ=PROVEN_E2_LOCAL_NORMAL_PATH
DB_CONTEXT_FORGERY_BY_COMPROMISED_OPS_PROCESS=POSSIBLE
OPEN_SECURITY_RISK=M11-OPEN-DB-CONTEXT-FORGERY
SERVICE_ROLE_RETIREMENT=NOT_YET_COMPLETE
```

## Question answered

For every business-data table reachable by DTH runtime workloads, which workload may perform which operation, under which trusted operator context/capability, against which rows, and does PostgreSQL itself enforce that boundary?

## Migration

`supabase/migrations/20260822180000_m11m_business_data_scope_rls.sql`

## Runtime identity honesty (mandatory)

| Path | Current connection identity | `dth_*` LOGIN? |
|------|----------------------------|----------------|
| Ops BFF / operator commands | `DTH_LOCAL_DATABASE_URL` / injected pool (typically `postgres`) | **NO** |
| Worker runners | Injected pool / `DTH_A*_DATABASE_URL` (typically `postgres`) | **NO** |
| Public intake (production) | `SUPABASE_SERVICE_ROLE_KEY` Data API | **NO** |
| M11F–M role proof tests | `roleUrl(dth_ops_api\|dth_worker\|dth_public_intake)` | **YES** |

```text
RUNTIME_APPLICATION_PATHS_USING_UNAPPROVED_ADMIN_CREDENTIALS=DOCUMENTED
RUNTIME_DATABASE_IDENTITY_ALIGNMENT=EXPLICIT_LATER_GATE
```

M11M proves enforcement **when** SQL executes as the intended LOGIN roles. It does **not** silently rewire application factories. Credential cutover remains a later canonical dependency (M11Q/S / hosted session path). Do not claim production runtime is already `dth_ops_api`-enforced.

## Table inventory (83)

| Schema | Count | RLS | FORCE | Zero-policy after M11M |
|--------|------:|-----|-------|------------------------|
| ops | 66 | ON | ON | 0 |
| public | 5 | ON | ON | 1 (`career_applications` = INTENTIONALLY_DENY_ALL) |
| security | 9 | ON | ON | 0 |
| workflow | 3 | ON | ON | 0 |

`UNCLASSIFIED_RUNTIME_TABLES=0`  
`TABLES_MISSING_M11M_POLICY_DECISION=0`

## Actor model

| Workload | Model |
|----------|-------|
| `dth_ops_api` | Human: M11K context + fresh M11I authority + capability-aware policies |
| `dth_worker` | Automation: no human context; purpose policies on granted domains |
| `dth_public_intake` | Narrow: leads, outbox, audit insert, acquisition attribution only |

## Capability mapping (no invented M11I caps)

| Domain | Ops SELECT | Ops WRITE |
|--------|------------|-----------|
| Case / qual / comm / calendar / docs / tariff / offer / switch / life / renewal | CASE_VIEW or operational write caps in context | TASK_WRITE, NOTE_WRITE, TAKEOVER_MANAGE, WORKFLOW_REPROCESS, PROVIDER_RECONCILE |
| Approvals (offer/switch) | case-read set | APPROVAL_DECIDE |
| Content | CONTENT_VIEW or content write caps | CONTENT_APPROVE, CONTENT_CANCEL, CONTENT_RECONCILE |
| Acquisition | ACQUISITION_VIEW or acquisition write caps | ACQUISITION_APPROVE/ACTIVATE/PAUSE/RECONCILE |
| Workflow | case-read set | WORKFLOW_REPROCESS |
| Provider/system state tables | read only | **none** (worker owns writes) |
| Control | M11L preserved | kill capabilities |

No `CASE_EDIT` invented. Read capabilities never authorize writes.

## Cross-domain isolation

| Boundary | Enforcement |
|----------|-------------|
| Intake → documents/offers/cases/control | grant deny + no policy |
| Content path with CASE_VIEW | content tables unread/unwritable |
| Operator → provider campaign/switch events | no ops write policy |
| Worker → security.operators | grant deny |
| Content domain ↔ customer documents | separate schemas/policies; content policies never grant document access |

## Open security risks (must remain explicit)

```text
RISK_ID=M11-OPEN-DB-CONTEXT-FORGERY
STATE=OPEN
DB_CONTEXT_FORGERY_BY_COMPROMISED_OPS_PROCESS=POSSIBLE
MUST_BE_CLOSED_BEFORE_PRODUCTION_SECURITY_SIGNOFF=YES
```

```text
RISK_ID=M11-OPEN-RUNTIME-DATABASE-IDENTITY-ALIGNMENT
STATE=OPEN
CURRENT_STATE=
- Ops API application pool may still run as postgres/admin credential
- Worker application pool may still run as postgres/admin credential
- Public intake still uses Supabase service_role
TARGET_STATE=
- human operator runtime → dth_ops_api
- automation worker → dth_worker
- public intake → dth_public_intake
MUST_BE_CLOSED_BEFORE_PRODUCTION_SECURITY_SIGNOFF=YES
```

Do **not** rewrite either issue as solved. Do **not** claim full production DB enforcement or service_role retirement complete.

Also open:

- `SERVICE_ROLE_RETIREMENT=NOT_YET_COMPLETE` (M11Q/S)
- Hosted session verification / MFA NOT_PROVEN
- Runtime LOGIN wiring to app factories = later gate (same as RISK 2)

## GDPR technical evidence

```text
GDPR_TECHNICAL_CONTROL_EVIDENCE=PARTIAL_E2_LOCAL
```

Least privilege, access limitation, integrity/confidentiality, separation of duties — technical only. **No** `DSGVO_COMPLIANT=YES`.

## Local proof

`npm run test:dth:m11m` → **21/21 PASS**

Full regression M11M→M11F, A11–A13, DB, boundary, kill, ops, CC, lint, build — PASS (uncommitted).

## Next gate

Canonical roadmap: **M11_SECURITY_GATE:M11N** (durable session / hosted AuthN path per A14-03).
