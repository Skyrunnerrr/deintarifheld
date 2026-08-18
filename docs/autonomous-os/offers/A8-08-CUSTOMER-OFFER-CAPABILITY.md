# A8-08 Customer offer capability

Opaque `base64url` 32-byte token; only SHA-256 stored. Route `/angebot?t=` + `/api/offer`. Headers: no-store, noindex, nofollow, no-referrer. Scope: view/accept/reject this revision. Cross-case tokens isolated. Client price/tariff/savings/approval fields rejected (`CLIENT_AUTHORITY_REJECTED`).
