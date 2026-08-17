# A5-16 Test Evidence

| Suite | Result |
|---|---|
| `npm run test:dth:a5` | **15/15 PASS** (`packages/workers/tests/a5-calendar-appointment.test.js`) |

## Cases covered

| ID | Assertion |
|---|---|
| A5-01 | schema tables present |
| A5-02/08/24 | DST spring gap + autumn fold |
| A5-03 | slot engine busy + max slots |
| A5-04 | E2E offer→book→confirm; A6 flags false; no case id in public view |
| A5-05 | double-click → one appointment |
| A5-06 | two slots → ≤1 booking |
| A5-07 | busy before book → no false confirm |
| A5-08 | timeout unknown → no blind retry |
| A5-09 | invalid / expired / superseded token |
| A5-10 | global kill + AUTOMATION_ENGINE kill + takeover |
| A5-11 | cancel blocks reminder |
| A5-12 | conference delay reconcile + deleted event |
| A5-13 | nonqualified cannot offer |
| A5-14 | ops grants not to anon/authenticated; live calendar count 0 |
| A5-15 | two customers same slot → ≤1 confirmed |

Evidence maturity: local E2 with `test_calendar` + mock email.  
LIVE_CALENDAR=NOT_PROVEN  
STAGING=NO  
PRODUCTION=NO
