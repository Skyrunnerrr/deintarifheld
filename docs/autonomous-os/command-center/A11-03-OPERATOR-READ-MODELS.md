# A11-03 Operator Read Models

`packages/db/src/a11/reads.js`:

- `getOpsOverview()`
- `listOpsInbox()`
- `listOpsCases()` / `getOpsCaseDetail()`
- `listOpsApprovals()`
- `listOpsJobs()`
- `listOpsLifecycle()` (A10 projection)
- `getControlState()`
- `listOpsAuditEvents()`
- `getProductionReadiness()`

Projections are not authority. Limit default 50, max 100. Job payload not exposed. `realtime: false`.
