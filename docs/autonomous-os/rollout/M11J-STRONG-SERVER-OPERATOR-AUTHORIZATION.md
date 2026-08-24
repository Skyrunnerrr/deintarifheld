# M11J Strong Server-Side Operator Authorization

## Result

```text
M11J_RESULT=CLOSED_E2_LOCAL_DB_REQUEST_CONTEXT_PENDING
SERVER_OPERATOR_AUTHZ=PROVEN_E2_LOCAL
HOSTED_REQUEST_AUTHZ=NOT_PROVEN
TRUSTED_IDENTITY_PROVIDER=TEST_E2_ONLY
HOSTED_IDENTITY_PROVIDER=NOT_IMPLEMENTED
```

## Question answered

```text
Given a trusted canonical operator identity,
may this operator perform THIS specific protected read or command RIGHT NOW?
```

Execution order (invariant):

```text
trusted identity (M11H seam)
→ fresh authority (M11I)
→ capability authorization (M11J)
→ domain policy / control version where required
→ domain command
→ durable audit
```

M11J does **not** implement Supabase hosted session verification, TOTP/aal2, per-request PostgreSQL context, or final RLS request-scoping (M11K+).

## Current auth path audit

| Layer | Before M11J | After M11J |
|-------|---------------|------------|
| Identity | `gateA11Request` → stable `operatorId` from TEST_* seam | unchanged |
| Authority | `resolveOperatorAuthority` available but not enforced on every path | enforced via `authorizeOperatorAction` |
| Commands | role/capability hints from test identity could influence behavior | `COMMAND_REQUIRED_CAPABILITY` + fresh DB authority only |
| Reads | CASE_VIEW assumed for authenticated operator | `authorizeOperatorRead` per surface |
| Client fields | `role`, `capabilities`, `personId`, `operatorId`, `authUserId` | rejected from authority decisions |
| Test mode | TEST_* → person session | TEST_* → `operatorId` → M11J (no TEST_OWNER wildcard) |
| Hosted | not implemented | production mode rejects TEST_* auth |

Classification of protected paths:

- **ALREADY_CAPABILITY_GATED** → upgraded to canonical M11J service
- **ROLE_GATED** → removed; capability-only
- **TEST_IDENTITY_GATED** → bridged through M11H operator_id + M11J
- **UNGATED** → closed (reads + commands)
- **DEFERRED_M11K** → DB request context / RLS per-human enforcement

## Canonical authorization service

Location: `packages/db/src/a11/operator-authz.js`

```javascript
authorizeOperatorAction({ operatorId, requiredCapability, expectedAuthorityVersion?, client* })
authorizeOperatorRead(pool, input)      // alias
authorizeOperatorCommand(pool, { operatorId, commandType, expectedAuthorityVersion?, client* })
```

Authority source: **M11I `resolveOperatorAuthority` only** (fresh DB read, no process cache).

Result taxonomy:

| Code | Meaning |
|------|---------|
| `AUTHORIZED` | operator active, role assigned, capability present |
| `OPERATOR_NOT_FOUND` | invalid/missing operator_id |
| `OPERATOR_DISABLED` | operator status not ACTIVE |
| `NO_ROLE_ASSIGNMENT` | active operator, no ACTIVE role |
| `CAPABILITY_DENIED` | capability not in current authority set |
| `AUTHORITY_DATA_UNAVAILABLE` | DB failure / ambiguous assignment |
| `STALE_AUTHORITY_VERSION` | client expected version ≠ current |
| `INVALID_CAPABILITY` | unknown capability string |
| `IDENTITY_NOT_TRUSTED` | client authority field forgery attempt |
| `UNKNOWN_COMMAND` | unregistered command type |

Default deny: any uncertainty → DENY (`M11J_AUTHZ_FAIL_OPEN=0`).

Stale-version policy: checked **before** capability denial when `expectedAuthorityVersion` is supplied. High-impact commands in `HIGH_RISK_COMMANDS` should carry expected version from client UI for optimistic stale detection; server always resolves current version independently.

## Command enforcement

All **27** registered `OperatorCommandType` values map 1:1 via `COMMAND_REQUIRED_CAPABILITY`. No generic fallback.

Entry point: `executeOperatorCommand` in `packages/db/src/a11/commands.js` — authorization precedes idempotency replay handling for new commands, and precedes all domain dispatch.

Command log additive columns (migration `20260822160000_m11j_operator_command_authz.sql`):

- `operator_id` — M11H stable actor
- `authority_version` — M11I revision at auth time
- `required_capability` — capability that authorized the command

Legacy `operator_person_id` retained for E2 compatibility; not used for authorization.

## Read enforcement

BFF: `packages/ops-api/src/bff/create-ops-bff.js`

| Surface | Required capability |
|---------|---------------------|
| overview, inbox, cases, case-detail, approvals, jobs, lifecycle, controls, readiness | `CASE_VIEW` |
| audit | `AUDIT_VIEW` |

Manifest: `A11_PROTECTED_VIEW_CAPABILITY` in shared contracts.

Content/acquisition dedicated BFF read routes: covered by A12/A13 test suites through command paths; distinct view capabilities preserved in M11I matrix for future surfaces.

## Client authority rejection

Zero authority from:

- `personId`, `role`, `capabilities`, `operatorId`, `authUserId` in body/query
- JWT/user_metadata role hints
- email

`gateA11Request` returns server-derived identity envelope only (`operatorId`, `identitySource`, no client role as authority).

## Test identity boundary

| Mode | Path |
|------|------|
| LOCAL E2 | `authenticateTestOperator` → `gateA11Request` → stable `operatorId` → M11J |
| HOSTED / production-like | TEST_* rejected; session verification NOT_IMPLEMENTED |

Bridge seeding: `bootstrapE2TestOperatorAuthority` (`packages/db/src/a11/test-operator-bridge.js`) provisions M11H operators + M11I role assignments for TEST_* identities.

## Operator actor / audit strategy

- Canonical actor: `operator_id` (UUID, M11H)
- Audit events for successful commands include `operator_id`, `authority_version`, `required_capability`
- Historical rows without `operator_id`: no backfill (additive migration only)

## M11K handoff

M11J proves server operator path enforces human AuthZ before domain execution.

M11K establishes trusted per-request DB context so PostgreSQL/RLS can independently enforce actor boundaries. **`dth_ops_api` broad DB privileges remain** until M11K/L/M.

## Limitations (security honesty)

| Claim | Status |
|-------|--------|
| SERVER_AUTHZ_ENGINE | PROVEN_E2_LOCAL |
| HOSTED_REQUEST_AUTHZ | NOT_PROVEN |
| SUPABASE_AUTH_SESSION_VERIFICATION | NOT_PROVEN |
| MFA / aal2 | NOT_PROVEN |
| DB bypass against compromised ops server | NOT addressed (M11K+) |

## Command matrix

| Command | Required capability | Stale version policy |
|---------|---------------------|----------------------|
| TAKEOVER_CASE | TAKEOVER_MANAGE | preferred (high-risk) |
| RESUME_CASE | TAKEOVER_MANAGE | preferred |
| APPROVE_OFFER / REJECT_OFFER_APPROVAL | APPROVAL_DECIDE | preferred |
| APPROVE_SWITCH_SUBMISSION / REJECT_SWITCH_SUBMISSION | APPROVAL_DECIDE | preferred |
| REPROCESS_JOB | WORKFLOW_REPROCESS | preferred |
| RECONCILE_* (5) | PROVIDER_RECONCILE | preferred |
| APPROVE_CONTENT / REJECT_CONTENT | CONTENT_APPROVE | preferred |
| CANCEL_CONTENT_PUBLICATION | CONTENT_CANCEL | preferred |
| RECONCILE_CONTENT_PUBLICATION | CONTENT_RECONCILE | preferred |
| APPROVE/REJECT_ACQUISITION_CAMPAIGN | ACQUISITION_APPROVE | preferred |
| ACTIVATE_ACQUISITION_CAMPAIGN | ACQUISITION_ACTIVATE | preferred |
| PAUSE/CANCEL_ACQUISITION_CAMPAIGN | ACQUISITION_PAUSE | preferred |
| RECONCILE_ACQUISITION_CAMPAIGN | ACQUISITION_RECONCILE | preferred |
| SET_GLOBAL_KILL | GLOBAL_KILL_MANAGE | preferred |
| SET_DOMAIN_KILL | DOMAIN_KILL_MANAGE | preferred |
| CREATE_TASK / UPDATE_TASK | TASK_WRITE | optional |
| ADD_NOTE | NOTE_WRITE | optional |

Authorized roles derived from M11I matrix (capability-based, not role-checked directly).

## View matrix

| View | Required capability | M11J enforced |
|------|---------------------|---------------|
| A11 operational surfaces | CASE_VIEW | yes |
| A11 audit | AUDIT_VIEW | yes |

## Local proof

`npm run test:dth:m11j` → **21/21 PASS**

Full post-M11J regression: M11J→M11F, DB, Shared, Boundary, Kill, A13, A12, A11, Ops, CC, lint, build — all PASS.
