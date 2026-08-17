# A5 Calendar Provider Decision Pack

**Status:** `OWNER_CALENDAR_PROVIDER_DECISION_REQUIRED=YES`

## Current proof

| Item | Value |
|---|---|
| Adapter | `test_calendar` only |
| Live provider calls | 0 |
| LIVE_CALENDAR | NOT_PROVEN |
| Staging / production | NO |

## Decision required

Choose production calendar provider and contract posture:

1. **Provider identity** (e.g. Google Calendar, Microsoft Graph, other) — not chosen in A5.
2. **Resource model** — single `dth_default_resource` vs multi-resource.
3. **Online meeting** — provider-native conference links vs external; delay/reconcile SLA.
4. **Idempotency** — provider key lifetime vs durable DTH `dth_idempotency_key` (DTH remains authority).
5. **Credentials custody** — secret store; never in client, jobs payload, or audit bodies.
6. **DPA / subprocessors** — legal follow-up (not claimed here).
7. **Kill mapping** — remains `AUTOMATION_ENGINE` (no new kill domain).

## Interface freeze (reuse)

Implement against existing methods: `getAvailability`, `createAppointment`, `getAppointment`, `cancelAppointment`, `updateAppointment` with result classes `PROVIDER_ACCEPTED` / `CONFLICT` / `OUTCOME_UNKNOWN` / `PERMANENT_FAILURE`.

## Explicit non-choice

Calendly-style embed / client-side booking widgets are out of A5 E2 scope. Public booking stays DTH-owned `/buchen` + `/api/booking` on Vercel dynamic.
