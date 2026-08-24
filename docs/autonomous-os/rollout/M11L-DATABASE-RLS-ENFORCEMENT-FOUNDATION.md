# M11L Database RLS Enforcement Foundation

## Result

```text
M11L_RESULT=CLOSED_E2_LOCAL_DATA_SCOPE_RLS_PENDING
DATABASE_RLS_FOUNDATION=PROVEN_E2_LOCAL
PROTECTED_OPERATOR_CONTEXT_ENFORCEMENT=PROVEN_E2_LOCAL
RLS_DEFAULT_DENY=PROVEN_E2_LOCAL
HIGH_IMPACT_CAPABILITY_RLS=PROVEN_E2_LOCAL
WORKLOAD_RLS_SEPARATION=PROVEN_E2_LOCAL
OPERATOR_ROW_ACTOR_BINDING=PROVEN_E2_LOCAL
DATABASE_RLS_HUMAN_AUTHZ=PARTIAL_E2_LOCAL
FULL_DATA_SCOPE_RLS=NOT_YET_COMPLETE
DB_CONTEXT_FORGERY_BY_COMPROMISED_OPS_PROCESS=POSSIBLE
```

## Question answered

How does PostgreSQL begin enforcing protected operator access using the trusted M11K request context, without weakening workload isolation or introducing new privilege bypasses?

## Architecture

```text
M11J authorize → M11K set_config (transaction-local)
        ↓
PostgreSQL RLS policies read security.dth_* helpers
        ↓
Default deny without fresh operator context
        ↓
Capability-aware writes on high-impact control surfaces
```

## Migration

`supabase/migrations/20260822170000_m11l_operator_context_rls.sql`

### SQL helpers (`security` schema)

| Function | Purpose |
|----------|---------|
| `dth_context_text(key)` | Safe read of transaction-local GUC |
| `dth_operator_context_present()` | All required context keys present |
| `dth_context_operator_id()` | Parsed operator UUID |
| `dth_context_required_capability()` | Exact M11J capability |
| `dth_context_authority_version()` | Authority revision |
| `dth_context_has_capability(text)` | Exact capability match |
| `dth_operator_authority_fresh()` | Re-validates M11I state (active operator, version, capability) |
| `dth_context_is_kill_capability()` | GLOBAL/DOMAIN kill capabilities |

EXECUTE granted to `dth_grp_ops_api` and `dth_grp_worker` only (PUBLIC revoked).

### Protected tables (wave 1)

| Table | Classification | RLS | FORCE RLS | Policies |
|-------|----------------|-----|-----------|----------|
| `security.control_state` | OPERATOR_PROTECTED | ON | YES | worker SELECT; ops SELECT open; ops write requires fresh + kill capability |
| `security.control_version` | OPERATOR_PROTECTED | ON | YES | worker SELECT; ops SELECT open; ops UPDATE requires fresh + kill capability |
| `security.control_audit` | AUDIT_PRIVATE | ON | YES | ops INSERT requires fresh context |
| `ops.operator_commands` | OPERATOR_PROTECTED | ON | YES | ops SELECT/INSERT require fresh context + row actor binding |
| `public.audit_events` | AUDIT_PRIVATE | ON (existing) | NO | ops INSERT fresh context; ops SELECT requires AUDIT_VIEW; worker INSERT preserved; intake INSERT preserved |

`ops.*` (66 tables): RLS already ON with zero policies → implicit deny-all for runtime roles. Full business-row policies deferred to **M11M**.

### Policy manifest (operator paths)

| TABLE | WORKLOAD | OPERATION | CONTEXT_REQUIRED | CAPABILITY_REQUIRED | RESULT |
|-------|----------|-----------|------------------|---------------------|--------|
| security.control_state | dth_ops_api | SELECT | NO | — | allow (catalog read) |
| security.control_state | dth_ops_api | INSERT | YES fresh | kill capability | allow/deny |
| security.control_version | dth_ops_api | UPDATE | YES fresh | kill capability | allow/deny |
| security.control_audit | dth_ops_api | INSERT | YES fresh | any authorized | allow/deny |
| ops.operator_commands | dth_ops_api | SELECT | YES fresh | — | allow/deny |
| ops.operator_commands | dth_ops_api | INSERT | YES fresh | row must match context | allow/deny |
| public.audit_events | dth_ops_api | INSERT | YES fresh | command capability | allow/deny |
| public.audit_events | dth_ops_api | SELECT | YES fresh | AUDIT_VIEW | allow/deny |
| security.control_state | dth_worker | SELECT | NO | — | allow |
| public.audit_events | dth_worker | INSERT | NO | — | allow |
| public.audit_events | dth_public_intake | INSERT | NO | — | allow (M11G) |

## Context forgery analysis (mandatory)

**Can ordinary `dth_ops_api` SQL set `dth.operator_id` / `dth.authority_version` / `dth.required_capability` via `set_config`?**

**YES** — proven in M11L-53.

```text
DB_CONTEXT_FORGERY_BY_COMPROMISED_OPS_PROCESS=POSSIBLE
```

Implications:

| Boundary | Status |
|----------|--------|
| Normal application path (M11J → M11K → RLS) | PROVEN_E2_LOCAL |
| Fully compromised ops server process | NOT cryptographically prevented |

Next hardening dependency: restricted context setter or server-attested transaction evidence (future gate; not M11L scope).

M11L does **not** claim cryptographic trust of GUC values against a compromised runtime.

## Open security risk (must remain explicit)

```text
RISK_ID=M11-OPEN-DB-CONTEXT-FORGERY
STATE=OPEN
NORMAL_APPLICATION_PATH=PROTECTED_E2_LOCAL
COMPROMISED_DTH_OPS_API_PROCESS=CAN_POTENTIALLY_FORGE_GUC_CONTEXT
CURRENT_IMPACT=PREVENTS_FULL_DATABASE_AUTHZ_CLAIM
REQUIRED_FUTURE_ACTION=EXPLICIT_SECURITY_HARDENING_DECISION_AND_PROOF
MUST_BE_CLOSED_BEFORE_PRODUCTION_SECURITY_SIGNOFF=YES
```

Do **not** rewrite this as solved. Do **not** claim `FULL_DATABASE_HUMAN_AUTHZ` or full compromised-server containment until a future gate proves anti-forgery with evidence.

## Security honesty

| Claim | Status |
|-------|--------|
| RLS default deny without context | PROVEN_E2_LOCAL (wave-1 tables) |
| High-impact kill writes capability-gated | PROVEN_E2_LOCAL |
| Operator row actor binding | PROVEN_E2_LOCAL |
| Worker / intake separation preserved | PROVEN_E2_LOCAL |
| Full data-scope / business-row RLS | NOT_YET_COMPLETE (M11M) |
| service_role retirement | NOT complete — documented bypass surface remains |
| Hosted Supabase session verification | NOT_PROVEN |
| MFA | NOT_PROVEN |

Runtime roles: `BYPASSRLS=NO`, do not own protected tables.

M11I catalog reads (`security.operators`, role/capability tables) remain open to `dth_ops_api` without operator context — required for authority resolution before M11K install.

## M11M handoff

M11L delivers foundation only. M11M refines:

- business-row / case / tenant data-scope policies on `ops.*`, `workflow.*`, `public.cases`
- remaining private-domain boundaries
- service_role retirement dependencies

## Local proof

`npm run test:dth:m11l` → **21/21 PASS**

Full regression: M11L→M11F, A11–A13, DB, boundary, kill, ops, CC, lint, build — PASS (uncommitted).
