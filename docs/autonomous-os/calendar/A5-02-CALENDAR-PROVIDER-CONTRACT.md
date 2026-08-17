# A5-02 Calendar Provider Contract

## Provider

| Item | E2 value |
|---|---|
| Adapter | `createTestCalendarProvider()` (`packages/db/src/a5/provider.js`) |
| Name | `test_calendar` (`A5_PROVIDER_TEST`) |
| Network | none |
| Live calls | always 0 (`getCalendarLiveCallCount`) |

## Interface (provider-neutral)

| Method | Role |
|---|---|
| `getAvailability` | busy periods for resource + range |
| `createAppointment` | create with DTH idempotency key |
| `getAppointment` | readback by `providerEventId` |
| `cancelAppointment` | soft-delete in test store |
| `updateAppointment` | time change (reschedule path) |

## Result classes

`PROVIDER_ACCEPTED` | `CONFLICT` | `OUTCOME_UNKNOWN` | `PERMANENT_FAILURE`  
Test modes: `ACCEPT`, `CONFLICT`, `TIMEOUT_UNKNOWN`, `FAIL`, `CONFERENCE_DELAYED`, `EVENT_DELETED`, `CANCEL_FAIL`.

## Kill mapping

Calendar writes → `KillDomain.AUTOMATION_ENGINE` (frozen 8-domain registry; **no 9th domain**).  
`OWNER_CALENDAR_PROVIDER_DECISION_REQUIRED=YES` — see `A5-CALENDAR-PROVIDER-DECISION-PACK.md`.

LIVE_CALENDAR=NOT_PROVEN.
