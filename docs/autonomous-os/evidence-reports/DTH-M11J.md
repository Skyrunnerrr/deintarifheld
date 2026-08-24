# DTH-M11J Evidence Report

**Gate:** M11J Strong Server-Side Operator Authorization  
**Branch:** `rollout/dth-a14-autonomy-rollout-001`  
**Base:** `5c1d80c34ca8bc2db86bc4e2f35af89d4ee4e1b0`  
**Status:** CLOSED_E2_LOCAL (uncommitted implementation)

## Proof summary

| Area | Evidence |
|------|----------|
| Canonical AuthZ service | `packages/db/src/a11/operator-authz.js` |
| Command enforcement | `executeOperatorCommand` auth before dispatch |
| Read enforcement | `create-ops-bff.js` → `authorizeOperatorRead` |
| Stale authority | version check before capability denial |
| Client forgery | reject client role/capability/identity fields |
| Operator actor | additive `operator_id` + `authority_version` on command log |
| Test suite | `npm run test:dth:m11j` 21/21 PASS |

## Critical invariants (expected 0)

```text
M11J_AUTHZ_FAIL_OPEN=0
COMMANDS_EXECUTED_WITHOUT_M11J_AUTHZ=0
PROTECTED_READS_WITHOUT_CAPABILITY_CHECK=0
DIRECT_ROLE_BASED_COMMAND_AUTHORIZATION=0
OWNER_AUTHZ_WILDCARD_BYPASSES=0
CLIENT_PERSON_ID_AUTHORITY=0
CLIENT_ROLE_AUTHORITY=0
CLIENT_CAPABILITY_AUTHORITY=0
AUTHZ_DB_FAILURE_FAIL_OPEN=0
TEST_IDENTITY_HOSTED_AUTH_BYPASSES=0
OPERATOR_COMMANDS_WITHOUT_CAPABILITY_MAPPING=0
STAGING_DB_MUTATIONS=0
PRODUCTION_DB_MUTATIONS=0
```

## Next gate

`M11_SECURITY_GATE:M11K` — per-request DB context
