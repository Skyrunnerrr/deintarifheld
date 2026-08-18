# A9-01 Switching domain model

`ops.switch_cases` (1:1 accepted offer revision) → `ops.switch_attempts` (one current; history preserved) → facts/requirements/approvals → `ops.switch_submission_intents` (durable, before provider) → `ops.switch_provider_events` (monotonic rank + replay key) → `ops.lifecycle_handoffs` (A10, `renewal_scheduled=false`).

A8 `ops.switch_preparations` remains the accept-time handoff row. Kill domain: AUTOMATION_ENGINE.
