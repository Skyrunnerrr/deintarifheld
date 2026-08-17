# A4-01 Communication Domain Model

## Reuse map

| Existing object | Decision |
|---|---|
| `lib/leads/mail.js` | REUSE as INTAKE_MAIL only. Not the communication engine. |
| `public.communication_events` (draft) | DEFER. Not promoted. |
| `ops.case_qualifications` / requirements / observations | REUSE. A3 remains qualification authority. |
| `workflow.jobs` / A1 worker | REUSE. All send/follow-up/inbound processing jobs. |
| `security.control_state` | REUSE. Global + INTERNAL_MAIL domain + takeover. |
| New `ops.conversations` | CREATE. One EMAIL conversation per Case. |
| New `ops.outbound_intents` | CREATE. Durable send authority. |
| New `ops.communication_messages` | CREATE. Canonical body snapshot. |
| New `ops.inbound_events` | CREATE. Verified provider inbound. |
| New `ops.provider_events` | CREATE. Delivery/readback facts. |
| New `ops.followup_schedules` | CREATE. Durable follow-up generations. |

## Authority

- A3 owns qualification truth.
- A4 owns messages / conversations / intents.
- A1 owns execution / scheduling.
- Case owns business identity.
- Provider adapter owns delivery facts only.

## Schema

Private `ops` schema, RLS on, no `anon` / `authenticated` / PUBLIC grants. ACL-02 unchanged.
