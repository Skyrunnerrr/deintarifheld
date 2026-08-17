# A5-07 Provider Reconciliation

## Trigger

- Create returns `OUTCOME_UNKNOWN` → appointment `OUTCOME_UNKNOWN` + `APPOINTMENT_RECONCILE` job.
- Conference delayed → `CONFIRMED_MEETING_LINK_PENDING` + reconcile job for link.
- Cancel provider fail → `RECONCILIATION_REQUIRED`.
- Reschedule cancel fail after new book → `RESCHEDULE_RECONCILIATION_REQUIRED`.

## `reconcileAppointment`

1. Read provider event by `provider_event_id`.
2. Absent → `RECONCILIATION_REQUIRED` / `PROVIDER_EVENT_MISSING` (human).
3. Start/end divergence → `PROVIDER_DIVERGENCE` (human).
4. Else sync `conference_url` / `conference_status` / appointment status; mark session `BOOKED` if needed.
5. Unknown without `provider_event_id` → `RECONCILIATION_REQUIRED` (no blind recreate).

## Provider events table

`ops.appointment_provider_events` — redacted payload, unique `(provider, provider_event_id, event_kind)` when event id present. Create path records `CREATED`.

## Evidence

Test A5-12: delayed conference → reconcile READY; deleted event → `PROVIDER_EVENT_MISSING`.
