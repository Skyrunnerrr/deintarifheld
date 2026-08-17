# A5-15 A6 Handoff Contract

## Function

`a6HandoffFromAppointment(appt)` in `packages/db/src/a5/booking.js`.

## When ready

Appointment status ∈ {`CONFIRMED`, `CONFIRMED_MEETING_LINK_PENDING`}:

```json
{
  "ready": true,
  "handoff": "A5_TO_A6",
  "appointmentId": "<uuid>",
  "caseId": "<uuid>",
  "callCompleted": false,
  "offerInputReady": false,
  "nextCapability": "DOCUMENT_INTELLIGENCE_PREPARE"
}
```

## Explicit inequalities (proven A5-04)

| Claim | Value |
|---|---|
| appointment confirmed | true (handoff ready) |
| call completed | **false** |
| offer input ready | **false** |

A6 owns document/OCR if attachments present. A5 does not mark call done or commercial offer readiness.

## When not ready

`NO_APPOINTMENT` | `NOT_CONFIRMED`
