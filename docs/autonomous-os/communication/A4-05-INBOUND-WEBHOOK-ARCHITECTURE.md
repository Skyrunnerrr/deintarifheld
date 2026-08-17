# A4-05 Inbound Webhook

Route: `app/api/webhooks/resend` — raw body verify → durable inbound_events → ACK → A1 process job.  
Secret: RESEND_WEBHOOK_SECRET (fail-closed if missing).  
No live webhook registration in A4 E2.
