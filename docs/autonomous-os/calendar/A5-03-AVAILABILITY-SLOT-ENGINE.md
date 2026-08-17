# A5-03 Availability Slot Engine

## Code

`packages/db/src/a5/slots.js` → `generateCandidateSlots`. Deterministic. No AI.

## Inputs

- `AppointmentPolicyV1` (TEST in E2)
- `now`
- provider `busyPeriods`
- active DTH appointments on same `calendar_resource_id` (`CONFIRMED`, `CONFIRMED_MEETING_LINK_PENDING`, `PENDING_PROVIDER`, `OUTCOME_UNKNOWN`, `RESCHEDULE_PENDING`)

## Rules

1. Walk local calendar days in policy IANA timezone (max 14 days).
2. Restrict to `workingDays` + `workingWindows`.
3. Emit starts every `slotIntervalMinutes` that fit `durationMinutes`.
4. Apply `minLeadTimeMs` / `bookingHorizonMs`.
5. Subtract busy + DTH appointments with before/after buffers.
6. Skip nonexistent local times (DST spring gap → `zonedLocalToUtc` returns null).
7. Sort UTC ascending; slice to `maxSlotsOffered`.

## Persistence

Slots stored as `ops.booking_slots` bound to `booking_session_id` + `generation`.  
Client selects opaque `slot_id` only — no client wall-clock authority.
