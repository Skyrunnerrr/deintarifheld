# A5-05 Booking State Machine

## Booking session (`BookingSessionStatus`)

```
PREPARING → OPEN → BOOKING_IN_PROGRESS → BOOKED
                 ↘ EXPIRED
                 ↘ SUPERSEDED
                 ↘ CANCELLED
                 ↘ EXCEPTION
```

- At most one active (`PREPARING`/`OPEN`/`BOOKING_IN_PROGRESS`) per `(case_id, purpose)` — unique partial index.
- Eligibility fingerprint reuse: same OPEN session returned as duplicate (no new token).
- Stale OPEN sessions superseded on new prepare.

## Appointment (`AppointmentStatus`)

```
PENDING_PROVIDER → CONFIRMED
                 → CONFIRMED_MEETING_LINK_PENDING → (reconcile) → CONFIRMED
                 → OUTCOME_UNKNOWN → RECONCILIATION_REQUIRED / reconcile
                 → FAILED
CANCEL_PENDING → CANCELLED
RESCHEDULE_PENDING → SUPERSEDED (old) + new booking
```

Unique: one current confirmed per `(case_id, purpose)` among `CONFIRMED` / `CONFIRMED_MEETING_LINK_PENDING`.

## Workflow states (observed)

`APPOINTMENT_OFFER_PREPARED` | `APPOINTMENT_CONFIRMED` | `BOOKING_OUTCOME_UNKNOWN` | `SLOT_NO_LONGER_AVAILABLE` | `NO_AVAILABLE_SLOTS` | `BOOKING_SESSION_EXPIRED`

## Capabilities (A1)

`APPOINTMENT_OFFER_PREPARE` · `APPOINTMENT_BOOK_SELECTED_SLOT` · `APPOINTMENT_RECONCILE` · `APPOINTMENT_REMINDER_DUE` · `APPOINTMENT_CANCEL` · `APPOINTMENT_RESCHEDULE` · `APPOINTMENT_SESSION_EXPIRE`
