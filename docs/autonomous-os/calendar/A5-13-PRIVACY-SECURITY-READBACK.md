# A5-13 Privacy + Security Readback

This is a technical delta, not a legal compliance claim.

## Purpose

Schedule an existing B2B CALL_READY consultation. Not marketing, not A13 acquisition.

## New processing

- booking session metadata + token **hash** (never raw bearer at rest)
- opaque slot rows (UTC + timezone)
- appointment row + provider event ids
- attendee **email hash** + A4 redacted recipient snapshot on intents
- reminder schedule metadata
- audit: `appointment.offer_prepared`, `appointment.confirmed` (ids/counts, not bodies)

## Schema privacy

`ops` private; RLS enabled on A5 tables; `REVOKE` from PUBLIC / `anon` / `authenticated` (test A5-14 grants empty).

## Kill / takeover

Calendar gate: `AUTOMATION_ENGINE` + global kill + control availability. Mail path: A4 `INTERNAL_MAIL`. Workflow takeover blocks prepare/select/book.

## Retention

`APPOINTMENT_RETENTION_POLICY_REQUIRED=true`. No new legal retention period invented.

## Unresolved

Owner appointment + calendar provider decisions; live provider DPA; public booking host/DNS; production policy values.
