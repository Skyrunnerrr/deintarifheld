# DTH-M11M Evidence Report

**Gate:** M11M Full Business Data-Scope RLS  
**Branch:** `rollout/dth-a14-autonomy-rollout-001`  
**Base:** `8c2d12a0e4652488cc3432d5f0b6d721db6758f2`  
**Status:** CLOSED_E2_LOCAL (uncommitted implementation)

## Proof summary

| Area | Evidence |
|------|----------|
| Migration | `supabase/migrations/20260822180000_m11m_business_data_scope_rls.sql` |
| Inventory | 83 tables classified; 0 unclassified |
| Runtime roles | Tests use `dth_ops_api` / `dth_worker` / `dth_public_intake` |
| App identity wiring | **NOT** cut over — EXPLICIT_LATER_GATE |
| Test suite | `npm run test:dth:m11m` 21/21 PASS |
| Open risk | M11-OPEN-DB-CONTEXT-FORGERY remains OPEN |

## Critical invariants (expected 0 where applicable)

```text
UNCLASSIFIED_RUNTIME_TABLES=0
TABLES_MISSING_M11M_POLICY_DECISION=0
M11M_PROTECTED_TABLES_WITH_RLS_DISABLED=0
REQUIRED_FORCE_RLS_MISSING=0
PROTECTED_BUSINESS_ACCESS_WITHOUT_CONTEXT=0
WORKER_POLICY_REGRESSIONS=0
PUBLIC_INTAKE_POLICY_REGRESSIONS=0
M11M_NEW_BROAD_DB_GRANTS=0
STAGING_DB_MUTATIONS=0
PRODUCTION_DB_MUTATIONS=0
PRODUCTION_SECURITY_ACTIVATIONS=0
```

## Open risk register

```text
RISK_ID=M11-OPEN-DB-CONTEXT-FORGERY
STATE=OPEN
DB_CONTEXT_FORGERY_BY_COMPROMISED_OPS_PROCESS=POSSIBLE
MUST_BE_CLOSED_BEFORE_PRODUCTION_SECURITY_SIGNOFF=YES

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

SERVICE_ROLE_RETIREMENT=NOT_YET_COMPLETE
RUNTIME_DATABASE_IDENTITY_ALIGNMENT=EXPLICIT_LATER_GATE
SUPABASE_AUTH_SESSION_VERIFICATION=NOT_PROVEN
MFA=NOT_PROVEN
```

Do **not** rewrite either production blocker as solved.

## Next gate

`M11_SECURITY_GATE:M11N`
