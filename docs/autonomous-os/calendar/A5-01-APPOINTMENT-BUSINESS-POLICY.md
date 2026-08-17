# A5-01 Appointment Business Policy

## Authority

`AppointmentPolicyV1` (`packages/shared/src/a5-appointment-contracts.js`).  
E2 uses **only** `TEST_APPOINTMENT_POLICY_V1` (`testOnly: true`). Must never be copied into production defaults.

## Allowed purpose (E2)

| Purpose | Status |
|---|---|
| `INITIAL_B2B_CONSULTATION` | ONLY allowed purpose |

## TEST policy (synthetic)

| Field | TEST value |
|---|---|
| durationMinutes | 30 |
| timezone | Europe/Berlin |
| workingDays | Mon–Fri |
| workingWindows | 09:00–17:00 |
| minLeadTimeMs | 0 |
| bookingHorizonMs | 7d |
| bufferBefore/After | 0 |
| slotIntervalMinutes | 30 |
| maxSlotsOffered | 5 |
| bookingLinkExpiryMs | 1h |
| reminderOffsetsMs | [50] (near-term synthetic) |
| maxReminders | 1 |
| calendarResourceId | `dth_default_resource` |
| meetingTitle | DeinTarifheld Beratung |

## Owner decisions unresolved (production)

All `OWNER_*_REQUIRED` flags remain `true`: call duration, timezone, working hours, min lead, horizon, buffers, slot count, link expiry, reminder / reschedule / cancellation / no-booking policies, calendar provider, retention.

See `A5-APPOINTMENT-OWNER-DECISION-PACK.md`.
