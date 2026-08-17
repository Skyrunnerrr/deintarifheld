# A3 Handoff Contract

A3 inputs via B2B_QUALIFICATION_START job payload:

- case_id, lead_id, schema_version
- workflow_id / correlation_id from job row

A3 loads authoritative lead fields via domain repository — not outbox. A3 must not parse transactional_outbox.

A4 does not change this handoff. Recipient email is re-resolved from Case→Lead at send time.
