# A5-12 Public Booking Security

## Surfaces

| Path | Role |
|---|---|
| `/buchen` | Next App Router shell + client (`app/buchen/*`) |
| `/api/booking` | GET view / POST select (`app/api/booking/route.js`) |

## Hosting note

Public marketing site remains Checkdomain **static** (`STATIC_EXPORT=1`).  
Booking requires Node runtime + DB → **Vercel dynamic**, not Checkdomain static export. Local pool only if DB URL is localhost/`127.0.0.1`.

## Capability model

Token is the only public capability. No Case/Lead/Workflow IDs in responses.  
POST accepts only `token` + `slot_id`. Rejects client time/calendar authority (`CLIENT_AUTHORITY_REJECTED`): `start_at`, `end_at`, `calendar_id`, `duration`, `provider`, `attendee`, `timezone`, redirect fields.

## Headers

`cache-control: no-store, private` · `x-robots-tag: noindex` · `referrer-policy: no-referrer`  
Page metadata: `robots: { index: false, follow: false }`.

## Limits

Token length ≤ 200; JSON body ≤ 4096; content-type must be JSON.

## Control gates on select

Global kill / `AUTOMATION_ENGINE` domain kill → `BOOKING_PAUSED`. Takeover → `TAKEOVER`. Must still be `QUALIFIED_FOR_CALL`.
