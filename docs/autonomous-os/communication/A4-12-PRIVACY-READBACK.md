# A4-12 Privacy Readback

This is a technical delta, not a legal compliance claim.

## Purpose

Handle an existing B2B customer inquiry (missing-information case communication). Not marketing, not A13 acquisition.

## New processing

- conversation metadata
- outbound rendered body (canonical `ops.outbound_intents` / `ops.communication_messages`)
- inbound body (canonical inbound/message row only)
- provider event IDs
- recipient email hash + redacted snapshot

Jobs, audit, and logs store IDs / counts / purpose / state — not full bodies, not raw answers, not secrets.

Attachments: metadata count only. No download/OCR.

## Retention

RETENTION_POLICY_INTEGRATION_REQUIRED. No new legal period invented. No indefinite log-retention assumption.

## Unresolved business/legal points

- Owner follow-up cadence
- Live reply address / receiving domain
- Provider DPA / receiving disclosure for staging
- Exact message retention under existing framework
