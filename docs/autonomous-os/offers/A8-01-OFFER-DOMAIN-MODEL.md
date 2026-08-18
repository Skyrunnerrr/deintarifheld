# A8-01 Offer domain model

`ops.offers` (one current per case) → `ops.offer_revisions` (immutable commercial snapshot copied from A7) → `ops.offer_options` (copied eligible A7 results) → `ops.offer_approvals` (revision-bound) → `ops.offer_tokens` (sha256 only) → `ops.offer_customer_decisions` (one terminal decision) → `ops.switch_preparations` (A9 handoff, `supplier_switch_initiated=false`).

States: DRAFT, APPROVAL_REQUIRED, APPROVED, READY, SENT, ACCEPTED, REJECTED, EXPIRED, SUPERSEDED, CANCELLED, INVALIDATED. No VIEWED (no trustworthy open tracking).
