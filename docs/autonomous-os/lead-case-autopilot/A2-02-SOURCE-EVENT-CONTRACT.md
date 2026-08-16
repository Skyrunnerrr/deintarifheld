# Source Event Contract

- event_type: BUSINESS_LEAD_ACCEPTED
- schema_version: 1
- aggregate_type: lead
- aggregate_id: lead UUID
- payload_redacted: schema_version, lead_id, lead_ref, lead_type (no email/phone/message)
- idempotency_key: lead-handoff:{leadId}
