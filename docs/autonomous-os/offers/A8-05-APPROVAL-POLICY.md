# A8-05 Approval policy

`OfferApprovalPolicyV1` E2: `AUTO_APPROVE_SYNTHETIC` when TEST_FIXTURE and `autoApproveSynthetic` and not `requireApproval`. Otherwise `APPROVAL_REQUIRED` until `recordSyntheticOfferApproval` (SYSTEM_TEST/HUMAN) on **this** revision.

Does not apply draft `090_approvals.sql`. Production four-eyes remains Owner-gated. `OWNER_OFFER_APPROVAL_POLICY_REQUIRED=true`. Client cannot set approved.
