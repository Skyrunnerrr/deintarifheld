# A12-13 Idempotency and Reconciliation

TX1: persist intent + audit. Fresh checks (revision current, approval hash, claims, kill, control). Provider call. TX2: provider result.

Timeout → `OUTCOME_UNKNOWN`. Re-publish of that intent returns `RECONCILIATION_REQUIRED` (`blindRetry=false`). No second logical post.

Readback FOUND: adopt provider post id. NOT_FOUND: `safeRetryEligible` after proven absence. MISMATCH: `PROVIDER_CONTENT_MISMATCH_REVIEW_REQUIRED`, do not adopt.

Same intent: at most one logical external publication (`DUPLICATE_PROVIDER_CONTENT_POSTS=0`).
