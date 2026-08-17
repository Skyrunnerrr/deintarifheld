# A5-08 Online Meeting Contract

## ConferenceStatus

`PENDING` | `READY` | `UNSUPPORTED` | `DELAYED`

## Mapping after provider create

| Provider conference | Appointment status | Confirmation email |
|---|---|---|
| READY + https URL | `CONFIRMED` | A4 `APPOINTMENT_CONFIRMATION` with link |
| DELAYED / no URL | `CONFIRMED_MEETING_LINK_PENDING` | **no** invented URL; reconcile later |

## URL validation

Only `https:` URLs, length ≤ 500. Invalid → stored as null (no fabricated meeting link).

## Test provider

Ready: `https://meeting.example.invalid/{providerEventId}`  
Delayed mode: `conferenceUrl=null`, `conferenceStatus=DELAYED`.

## Non-goals

No client-supplied meeting URL. No non-https schemes. No confirmation that claims a link when status is DELAYED.
