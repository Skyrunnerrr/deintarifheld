# M11H Operator Identity Mapping

## Result

```text
M11H_RESULT=CLOSED_E2_LOCAL_HOSTED_AUTH_BINDING_PROOF_PENDING
SUPABASE_AUTH_SESSION_VERIFICATION=NOT_PROVEN
MFA=NOT_PROVEN
```

## Question answered

```text
verified Supabase Auth subject (auth.users.id UUID)
        ↓
stable DTH operator_id
        ↓
ACTIVE | DISABLED | NOT_PROVISIONED
```

M11H does **not** assign roles, capabilities, or command authorization (M11I–K).

## Data model

| Table | Purpose |
|-------|---------|
| `security.operators` | Stable `operator_id`, `display_label`, optional `email` (display only), `status` |
| `security.operator_auth_identities` | `auth_user_id` → `operator_id` binding, `status` |

Constraints:
- unique active `auth_user_id` binding
- unique active binding per `operator_id`
- `ON DELETE RESTRICT` — no audit identity destruction via cascade
- no FK to `auth.users` (platform lifecycle decoupled; subject stored as UUID)

## Resolution contract

`resolveOperatorByVerifiedAuthSubject({ verifiedAuthUserId })` outcomes:

| Code | Meaning |
|------|---------|
| `ACTIVE_OPERATOR` | mapped + active |
| `NOT_PROVISIONED` | no active binding |
| `DISABLED` | mapping exists but operator/binding inactive |
| `INVALID_SUBJECT` | malformed UUID |
| `AMBIGUOUS_BINDING` | >1 active binding (constraint should prevent) |
| `DATA_UNAVAILABLE` | DB read failure — fail closed |

Guards (no DB):
- `rejectClientOperatorIdentity` — body `operatorId` / `authUserId` rejected
- `rejectMetadataOperatorAuthority` — email / `user_metadata.role` rejected

## Database authority

| Role | `security.operators` | `security.operator_auth_identities` |
|------|---------------------|-------------------------------------|
| `dth_ops_api` | SELECT | SELECT |
| `dth_worker` | none | none |
| `dth_public_intake` | none | none |
| `anon` / `authenticated` / PUBLIC | none | none |

RLS: enabled; SELECT policies only for `dth_grp_ops_api`.

## Test vs hosted boundary

| Mode | Identity path |
|------|---------------|
| LOCAL E2 | `TEST_*` + `authenticateTestOperator` → `resolveOperatorIdentity` (unchanged) |
| HOSTED (future) | verified Supabase session → `auth.users.id` → M11H resolver |

No implicit fallback between modes. `TEST_*` blocked in production via existing guards.

## A11 transition

`ops.operator_commands` still records `operator_person_id` (E2). Future: bind `operator_id` from M11H resolution in M11I/J.

## Owner decisions still open

- `OD-A11-SESSION-POLICY` — session lifetimes
- `OD-A11-OPERATOR-PROVISIONING-POLICY` — who may provision/disable/rebind hosted operators
- `OPERATOR_AUTH_REBIND_POLICY` — account replacement workflow

## M11I handoff

Expose only: `operator_id`, `status`, resolution result. No implicit role/capability.

## Local proof

`npm run test:dth:m11h` → **17/17 PASS**

## Hosted limitations

Supabase session verification + hosted binding proof: **NOT_PROVEN**
