# A5-11 Timezone + DST

## Authority

UTC storage (`start_at_utc` / `end_at_utc`). Display/policy zone is IANA (`Europe/Berlin` in TEST).  
No CET/CEST abbreviations as authority (`packages/db/src/a5/timezone.js`).

## Helpers

| Function | Behavior |
|---|---|
| `zonedLocalToUtc` | Local wall → UTC; spring gap → `null`; autumn fold=0 earlier, fold=1 later |
| `zonedParts` | UTC → local parts + weekday |
| `formatInTimeZone` | `de-DE` labels for offer/confirm/public view |

## Slot engine

Skips DST nonexistent local starts. Proven A5-02/08/24: 2026-03-29 02:30 Berlin = null; 2026-10-25 02:30 fold 0 vs 1 differ by 1h.

## Owner

`OWNER_TIMEZONE_REQUIRED=true` for production policy (not frozen by TEST).
