# A4-15 A5 Handoff Contract

When A3 reevaluation reaches `QUALIFIED_FOR_CALL`:

- missing-info follow-ups cancelled (`CANCELLED_QUALIFIED`)
- conversation status `QUALIFIED`
- A1 job `APPOINTMENT_OFFER_PREPARE` enqueued (`handoff: A4_TO_A5`)
- A5 handler runs `prepareAppointmentOffer` (session + slots + A4 `APPOINTMENT_OFFER` intent)
- no live calendar provider call in E2 (`test_calendar` only)
- appointment emails go through A4 purposes (`APPOINTMENT_OFFER` / `CONFIRMATION` / `REMINDER` / …) on `INTERNAL_MAIL`

A5 owns slot search, offer send, booking, reminders, cancel/reschedule, provider reconciliation.

A6 owns document/OCR if `attachment_count > 0`. Handoff: appointment confirmed ≠ call completed ≠ offer input ready (`a6HandoffFromAppointment`).

Evidence: `docs/autonomous-os/calendar/` · `A5_RESULT=CLOSED_E2_LOCAL_CALENDAR_PROVIDER_STAGING_PENDING`
