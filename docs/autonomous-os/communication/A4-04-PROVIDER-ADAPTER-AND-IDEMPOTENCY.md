# A4-04 Provider Adapter and Idempotency

## Official Resend facts (checked 2026-08-17)

| Fact | Evidence |
|---|---|
| SDK in repo | `resend` `^6.18.1` — not upgraded |
| Send API | `resend.emails.send(..., { idempotencyKey })` supported |
| Provider idempotency window | 24 hours ([Resend idempotency docs](https://resend.com/docs/dashboard/emails/idempotency-keys)) |
| Inbound | `email.received` webhook is metadata-only |
| Body retrieval | `resend.emails.receiving.get(email_id)` |
| Webhook verify | raw body + `svix-id` / `svix-timestamp` / `svix-signature` ([verify docs](https://resend.com/docs/webhooks/verify-webhooks-requests)) |

## A4 E2

- Test adapter: ACCEPT / FAIL / TIMEOUT_UNKNOWN / retrieve fixtures. No network.
- Live Resend adapter exists behind explicit construction. Tests never call it.
- DTH `dth_idempotency_key` UNIQUE is the send authority.
- Provider key is defense-in-depth only.

RESEND_OUTBOUND_ADAPTER=TESTED_E2_WITH_MOCK  
RESEND_INBOUND_WEBHOOK=LOCAL_SIGNATURE_PROVEN (test verifier + raw-body route)  
LIVE_RESEND_OUTBOUND=NOT_PROVEN  
LIVE_RESEND_INBOUND=NOT_PROVEN
