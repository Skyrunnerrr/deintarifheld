# A5-10 Reminder / Cancel / Reschedule

## Reminders (`ops.appointment_reminders`)

- Scheduled at book confirm from `policy.reminderOffsetsMs` (capped by `maxReminders`).
- Job: `APPOINTMENT_REMINDER_DUE` → `executeAppointmentReminder` → A4 `APPOINTMENT_REMINDER` intent.
- Statuses: `SCHEDULED` | `SENT` | `CANCELLED_APPOINTMENT` | `CANCELLED_RESCHEDULE` | `CANCELLED_STALE` | `CANCELLED_SUPPRESSED` | `CANCELLED_KILL`.
- Cancel appointment → scheduled reminders → `CANCELLED_APPOINTMENT` (test A5-11).
- Non-confirmed appointment at due time → `CANCELLED_STALE`.
- `do_not_automatically_contact` → `CANCELLED_SUPPRESSED`.

## Cancel

`cancelAppointment`: `CANCEL_PENDING` → provider cancel → `CANCELLED`. Provider fail → `RECONCILIATION_REQUIRED`. Idempotent if already cancelled.

## Reschedule

`rescheduleAppointment`: new select+book on token/slot → cancel old → old `SUPERSEDED` with `rescheduled_from` pointing at new; reminders on old → `CANCELLED_RESCHEDULE`. Cancel fail after new confirm → reconciliation on new appointment.

Owner reschedule/cancellation policies unresolved for production (`OWNER_RESCHEDULE_POLICY_REQUIRED`, `OWNER_CANCELLATION_POLICY_REQUIRED`).
