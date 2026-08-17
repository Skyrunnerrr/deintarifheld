# A5-14 Staging Dependencies

Not performed in A5 E2.

## Blockers

- `OWNER_CALENDAR_PROVIDER_DECISION_REQUIRED` (Google / Microsoft / other)
- All `OWNER_*` appointment policy decisions (see Owner decision pack)
- Live calendar credentials custody + secret never in client/jobs/audit
- Staging calendar resource + attendee protection
- Public `/buchen` + `/api/booking` on Vercel dynamic (not Checkdomain static)
- M11F/G worker grants for new `ops` appointment tables (as applicable)
- M11H–M / M11N / M11P staging E2E as applicable
- A4 live Resend still pending (appointment mail reuses A4)
- Approved production `AppointmentPolicyV1` (not TEST)

## Status flags

STAGING=NO  
PRODUCTION=NO  
LIVE_CALENDAR=NOT_PROVEN
