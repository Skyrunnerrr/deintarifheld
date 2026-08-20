# A12-14 A11 Control Integration

One Command Center. No second admin UI.

Capabilities: CONTENT_VIEW (viewer+), CONTENT_APPROVE (approver/owner), CONTENT_CANCEL + CONTENT_RECONCILE (operator/owner).

Commands: APPROVE_CONTENT, REJECT_CONTENT, CANCEL_CONTENT_PUBLICATION, RECONCILE_CONTENT_PUBLICATION. Same AuthN/AuthZ, idempotency, confirm, stale-view hash, audit as A8/A9.

Inbox surfaces BLOCKED, APPROVAL_REQUIRED, OUTCOME_UNKNOWN, FAILED. Approvals list includes content rows. Overview pending-approval count includes content. Waiting-provider includes `OUTCOME_UNKNOWN` intents. Readiness adds A12 AI / publisher / strategy / autopublish gates as BLOCKED (`falseGreens=0`).
