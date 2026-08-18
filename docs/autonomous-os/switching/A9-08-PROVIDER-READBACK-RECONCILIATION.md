# A9-08 Provider readback reconciliation

`reconcileSwitchAttempt` reads TEST adapter by idempotency/order id. PENDING ≠ CONFIRMED. Product mismatch → REVIEW_REQUIRED. REJECTED does not create A10. CONFIRMED requires matching tariff_version_id.
