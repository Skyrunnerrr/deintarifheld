# A5-04 Booking Session Token

## Mint

`mintToken()` in `packages/db/src/a5/booking.js`:

- raw bearer: 32 bytes `base64url`
- stored: `token_hash = sha256(token)` only
- never persist raw token after create response
- duplicate prepare with same eligibility fingerprint returns `token: null`

## Session fields (ops.booking_sessions)

`booking_ref` (unique human ref), `token_hash` (unique), `token_version`, `eligibility_fingerprint`, `slot_generation`, `expires_at`, policy/resource metadata.

## Offer URL (E2)

`https://booking.deintarifheld.invalid/buchen?t={token}` — synthetic host in offer body; public app path is `/buchen`.

## Lookup

`getBookingSessionByToken` hashes inbound token and matches `token_hash`.

## Public view

`getPublicBookingView`: returns `bookingRef`, purpose label, timezone, slot labels — **no Case/Lead/Workflow IDs**.

## Failure codes

`INVALID_TOKEN` | `EXPIRED_TOKEN` | `SUPERSEDED_TOKEN` | `SESSION_NOT_OPEN`
