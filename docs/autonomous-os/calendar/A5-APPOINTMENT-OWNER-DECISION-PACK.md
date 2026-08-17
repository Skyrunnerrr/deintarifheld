# A5 Appointment Owner Decision Pack

**Status:** UNRESOLVED for production. E2 uses `TEST_APPOINTMENT_POLICY_V1` only (`testOnly: true`).

## Decisions required

| Flag | Question | Blocks |
|---|---|---|
| `OWNER_CALL_DURATION_REQUIRED` | Consultation length (minutes) | slot length, calendar blocks |
| `OWNER_TIMEZONE_REQUIRED` | Canonical IANA zone for working hours | slot engine, labels |
| `OWNER_WORKING_HOURS_REQUIRED` | Working days + daily windows | availability |
| `OWNER_MIN_LEAD_TIME_REQUIRED` | Earliest bookable offset | offer fairness |
| `OWNER_BOOKING_HORIZON_REQUIRED` | How far ahead to offer | horizon |
| `OWNER_BUFFER_POLICY_REQUIRED` | Before/after buffers vs busy | double-book risk |
| `OWNER_SLOT_COUNT_REQUIRED` | Max slots per offer | UX + load |
| `OWNER_BOOKING_EXPIRY_REQUIRED` | Link / session TTL | expire jobs |
| `OWNER_REMINDER_POLICY_REQUIRED` | Offsets + max reminders | reminder jobs |
| `OWNER_RESCHEDULE_POLICY_REQUIRED` | Who/when may reschedule | reschedule path |
| `OWNER_CANCELLATION_POLICY_REQUIRED` | Who/when may cancel | cancel path |
| `OWNER_NO_BOOKING_POLICY_REQUIRED` | Behavior when no slots | `NO_AVAILABLE_SLOTS` |
| `APPOINTMENT_RETENTION_POLICY_REQUIRED` | Retention under existing framework | ops data lifecycle |

## Non-decisions (already frozen in code for E2)

- Purpose allowlist: `INITIAL_B2B_CONSULTATION` only
- UTC storage authority
- Opaque `slot_id` selection (no client time authority)
- Appointment confirmed ≠ call completed ≠ offer input ready

## Constraint

Do **not** promote TEST durations/offsets into production defaults without explicit Owner sign-off.
