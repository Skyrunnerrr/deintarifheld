# A5-09 A4 Communication Integration

## Kill / domain

Appointment customer mail → A4 outbound on `KillDomain.INTERNAL_MAIL`.  
Calendar provider writes → `AUTOMATION_ENGINE`.  
A5 does not add a 9th kill domain.

## MessagePurpose extensions

Migration + `a4-communication-contracts.js`:

- `APPOINTMENT_OFFER`
- `APPOINTMENT_CONFIRMATION`
- `APPOINTMENT_REMINDER`
- `APPOINTMENT_RESCHEDULE_CONFIRMATION`
- `APPOINTMENT_CANCELLATION_CONFIRMATION`

## Templates (DE, server-only)

`packages/db/src/a5/templates.js`:

| Purpose | Template ID |
|---|---|
| OFFER | `B2B_APPOINTMENT_OFFER_DE_V1` |
| CONFIRM | `B2B_APPOINTMENT_CONFIRM_DE_V1` |
| REMINDER | `B2B_APPOINTMENT_REMINDER_DE_V1` |

Rendered into `ops.outbound_intents` (`READY_TO_SEND`) + A1 `B2B_COMMUNICATION_SEND` job.

## A4 → A5 handoff

On qualification `QUALIFIED_FOR_CALL` after inbound processing (`communicate.js`): enqueue `APPOINTMENT_OFFER_PREPARE` with payload `{ handoff: 'A4_TO_A5' }`. Handler calls `prepareAppointmentOffer` (no longer placeholder-only).

## Suppressions

`conversations.do_not_automatically_contact` blocks offer/confirm/reminder creates.  
Missing-info follow-ups / READY intents cancelled on offer prepare (`CANCELLED_QUALIFIED` / `CANCELLED_STALE`).
