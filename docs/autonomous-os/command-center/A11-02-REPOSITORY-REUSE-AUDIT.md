# A11-02 Repository Reuse Audit

| Surface | State | A11 action |
|---|---|---|
| `packages/cc` Inbox/Cases/Tasks UI | EXISTING LOCAL_ONLY read-only | EXTEND to 9 operator views |
| `packages/ops-api` `/ops/v1` BFF | EXISTING | EXTEND `/ops/v1/a11/*` |
| P3 limited writes (note/task) | EXISTING | REUSE |
| P3 memory kill | LOCAL_ONLY / not durable | DEFER as authority; A1 durable used |
| A1 control/takeover/reprocess | PROVEN_E2 | REUSE |
| A8/A9 approvals | PROVEN_E2 | REUSE + reject helpers |
| A4–A10 reconcile functions | PROVEN_E2 | REUSE via registry |
| A10 `listA11LifecycleProjection` | PROVEN_E2 | REUSE |
| Production operator IdP | NOT_IMPLEMENTED | DEFER Owner pack |
| Second Command Center | NOT created | — |
