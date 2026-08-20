# A12-08 Approval Policy

`ContentApprovalPolicyV1`: bind revision + content hash + policy version. Stale hash reuse forbidden.

E2: LOW may auto-approve when `autoApproveRiskClasses` includes LOW (test override / synthetic default). HIGH requires operator `APPROVE_CONTENT`. REJECTED items cannot schedule.

A11: `TEST_APPROVER` has `CONTENT_APPROVE`. Viewer cannot approve. Command is high-risk (`confirm=true`). Success is audited `content.approved` + `a11.command.APPROVE_CONTENT`.

`OWNER_CONTENT_AUTOPUBLISH_POLICY_REQUIRED=YES`. Production auto-publication is not approved.
