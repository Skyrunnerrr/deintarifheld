# DTH-M11K Evidence Report

**Gate:** M11K Trusted Database Request Context  
**Branch:** `rollout/dth-a14-autonomy-rollout-001`  
**Base:** `b7f8ade7364350c5f22b5ebaafe947f6f5f06bc1`  
**Status:** CLOSED_E2_LOCAL (uncommitted implementation)

## Proof summary

| Area | Evidence |
|------|----------|
| Context module | `packages/db/src/a11/operator-db-context.js` |
| Pool/client propagation | `packages/db/src/pg-pool-or-client.js` |
| Command integration | `executeOperatorCommand` → `withAuthorizedOperatorTransaction` |
| TOCTOU | `verifyOperatorAuthorityFreshness` inside txn |
| Pool isolation | M11K-10/11/12/13 tests |
| Test suite | `npm run test:dth:m11k` 14/14 PASS |

## Critical invariants (expected 0)

```text
REQUEST_CONTEXT_POOL_LEAKS=0
REQUEST_CONTEXT_CROSS_OPERATOR_LEAKS=0
CLIENT_CONSTRUCTED_TRUSTED_DB_CONTEXTS=0
PROTECTED_WRITES_WITHOUT_TRUSTED_DB_CONTEXT=0
AUTHORITY_REVOKED_BETWEEN_AUTHZ_AND_WRITE_SUCCESSES=0
M11K_NEW_BROAD_DB_GRANTS=0
STAGING_DB_MUTATIONS=0
PRODUCTION_DB_MUTATIONS=0
```

## Next gate

`M11_SECURITY_GATE:M11L`
