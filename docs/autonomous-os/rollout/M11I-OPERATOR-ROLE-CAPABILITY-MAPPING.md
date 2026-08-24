# M11I Operator Role + Capability Mapping

## Result

```text
M11I_RESULT=CLOSED_E2_LOCAL_STRONG_AUTHZ_ENFORCEMENT_PENDING
STRONG_OPERATOR_AUTHZ=NOT_YET_ENFORCED
SUPABASE_AUTH_SESSION_VERIFICATION=NOT_PROVEN
```

## Question answered

```text
ACTIVE operator_id (from M11H)
        ↓
canonical role assignment (one ACTIVE per operator, V1)
        ↓
explicit capability set (from role-capability matrix)
        ↓
authority_version (monotonic per operator)
```

M11I does **not** enforce HTTP/command authorization (M11J) or per-request DB context (M11K).

## Data model

| Table | Purpose |
|-------|---------|
| `security.operator_roles` | Canonical role catalog (`VIEWER`, `OPERATOR`, `APPROVER`, `OWNER`) |
| `security.operator_capabilities` | Canonical capability catalog (A11-A13 strings + risk class) |
| `security.role_capabilities` | Explicit role→capability matrix (OWNER has explicit rows, no wildcard) |
| `security.operator_role_assignments` | Operator→role assignment with `ACTIVE`/`REVOKED` history |

Constraints:
- one `ACTIVE` assignment per `operator_id` (partial unique index)
- FK to `security.operators` and `security.operator_roles`
- `authority_version` monotonic per operator
- revoked assignments retain history (`revoked_at` required when `REVOKED`)

## Resolution contract

`resolveOperatorAuthority({ operatorId })` outcomes:

| Code | Meaning |
|------|---------|
| `ACTIVE_AUTHORITY` | active operator + active role → explicit capabilities + version |
| `NO_ROLE_ASSIGNMENT` | active operator, no active role |
| `OPERATOR_DISABLED` | operator status not `ACTIVE` |
| `INVALID_OPERATOR` | malformed/unknown `operator_id` |
| `AUTHORITY_DATA_UNAVAILABLE` | DB failure or ambiguous active assignment |

Guards (no DB):
- `rejectClientOperatorRole` — body/query `role` rejected
- `rejectClientOperatorCapabilities` — client capability lists rejected

## Role-capability matrix (canonical)

| Capability | VIEWER | OPERATOR | APPROVER | OWNER |
|------------|:------:|:--------:|:--------:|:-----:|
| CASE_VIEW | ✓ | ✓ | ✓ | ✓ |
| AUDIT_VIEW | ✓ | ✓ | ✓ | ✓ |
| CONTENT_VIEW | ✓ | ✓ | ✓ | ✓ |
| ACQUISITION_VIEW | ✓ | ✓ | ✓ | ✓ |
| TASK_WRITE | | ✓ | | ✓ |
| NOTE_WRITE | | ✓ | ✓ | ✓ |
| TAKEOVER_MANAGE | | ✓ | | ✓ |
| WORKFLOW_REPROCESS | | ✓ | | ✓ |
| PROVIDER_RECONCILE | | ✓ | | ✓ |
| CONTENT_CANCEL | | ✓ | | ✓ |
| CONTENT_RECONCILE | | ✓ | | ✓ |
| ACQUISITION_PAUSE | | ✓ | | ✓ |
| ACQUISITION_RECONCILE | | ✓ | | ✓ |
| APPROVAL_DECIDE | | | ✓ | ✓ |
| CONTENT_APPROVE | | | ✓ | ✓ |
| ACQUISITION_APPROVE | | | ✓ | ✓ |
| ACQUISITION_ACTIVATE | | | | ✓ |
| GLOBAL_KILL_MANAGE | | | | ✓ |
| DOMAIN_KILL_MANAGE | | | | ✓ |

Source of truth: `packages/shared/src/a11-command-center-contracts.js` → seeded into DB (OWNER explicit, not `ALL_CAPS` wildcard).

## Command capability matrix (M11J input)

Every `OperatorCommandType` maps to exactly one `OperatorCapability` via `COMMAND_REQUIRED_CAPABILITY` in shared contracts. Resolver does not authorize commands — M11J will use this manifest.

## View capability matrix (M11J input)

| Surface | Required capability |
|---------|---------------------|
| A11 overview/inbox/cases/approvals/jobs/lifecycle/controls/readiness | `CASE_VIEW` |
| A11 audit | `AUDIT_VIEW` |

## Database authority

| Role | M11I tables |
|------|-------------|
| `dth_ops_api` | SELECT only (4 tables) |
| `dth_worker` | none |
| `dth_public_intake` | none |
| `anon` / `authenticated` / PUBLIC | none |

RLS: enabled; SELECT policies only for `dth_grp_ops_api`.

Runtime role-admin writes (`INSERT` assignments, mutate matrix): **denied** for `dth_ops_api`.

## Test vs hosted boundary

| Mode | Authority path |
|------|----------------|
| LOCAL E2 | `TEST_*` identities still use `resolveOperatorIdentity` (unchanged); M11I DB model proven separately with synthetic operators |
| HOSTED (future) | M11H `operator_id` → `resolveOperatorAuthority` → M11J enforcement |

No TEST_* fallback in hosted mode.

## M11J handoff

Expose:
- `operator_id`
- `role`
- explicit `capabilities[]`
- `authorityVersion`

M11J must enforce fresh server-side capability checks on every protected read/command. Client role/capability fields remain non-authoritative.

## Owner decisions still open

- `OD-A11-OPERATOR-PROVISIONING-POLICY`
- `OD-A11-ROLE-ADMINISTRATION-POLICY`
- `OD-A11-SESSION-POLICY`

## Local proof

`npm run test:dth:m11i` → **29/29 PASS**

## Hosted limitations

Hosted authority resolution + role administration: **NOT_PROVEN**
