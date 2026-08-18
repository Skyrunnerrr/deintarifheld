# A8-04 Offer versioning and staleness

Material commercial input change (tariff version, micro amounts, profile fingerprint, catalogue, validity policy) → new revision; old `is_current=false` SUPERSEDED; tokens superseded; prior approval does not apply.

Stale A7 evaluation at send → INVALIDATED, providerCalls=0. SENT snapshot remains historically displayed. Accept uses exclusive `valid_until <= now()` (DB time).
