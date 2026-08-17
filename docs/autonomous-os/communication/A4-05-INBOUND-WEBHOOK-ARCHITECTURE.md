# A4-05 Inbound Webhook Architecture

Path: PROVIDER → `POST /api/webhooks/resend` → raw `req.text()` → verify → durable `ops.inbound_events` → HTTP ACK → A1 `B2B_INBOUND_EMAIL_PROCESS`.

ACK means: verified event durably accepted. Not business completion.

Missing `RESEND_WEBHOOK_SECRET` outside test: HTTP 503 fail-closed.

Invalid signature: HTTP 400, no durable business event, no A1 job.

Replay: unique `provider_event_id` → idempotent 200.

Unmatched at webhook time: event persisted; no Case mutation.

No browser CSRF. Authenticity is the provider signature.

E2 route uses the mock verifier. Live dashboard/MX/webhook registration: NOT performed.
