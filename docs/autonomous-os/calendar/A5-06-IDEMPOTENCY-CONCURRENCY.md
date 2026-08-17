# A5-06 Idempotency + Concurrency

## Durable keys

| Key | Scope |
|---|---|
| `appointment-offer/{caseId}/{fp}/{sessionId}` | outbound offer intent |
| `appointment-create/{caseId}/{sessionId}/{slotId}` | appointment `dth_idempotency_key` (unique) |
| `appointment-confirm/{appointmentId}` | confirmation intent |
| `appointment-reminder/{appointmentId}/{generation}` | reminder intent |
| `b2b-appt-book:{sessionId}:{slotId}` | book job |
| `b2b-appt-reconcile:{appointmentId}` | reconcile job |
| `b2b-appt-reminder:{appointmentId}:{gen}` | reminder row + job |
| `a5-appt-prepare:{caseId}:{qual.revision}` | A4→A5 prepare job |

## Concurrency controls

1. Partial unique index: one active booking session per case+purpose.
2. `UPDATE … WHERE status='OPEN'` claim → `BOOKING_IN_PROGRESS` (double-click / two-slot race).
3. `pg_advisory_xact_lock(hashtext(calendar_resource_id))` on select + create.
4. Overlap check on active appointments before `PENDING_PROVIDER` insert.
5. Fresh provider availability check before `createAppointment`.
6. Provider create **outside** long TX; result persisted in second TX.
7. Provider idempotency: same `idempotencyKey` returns duplicate accepted event.

## Blind retry

`OUTCOME_UNKNOWN` → enqueue reconcile; re-enter book path must not blind-create (`blindRetry: false`). Proven in test A5-08.
