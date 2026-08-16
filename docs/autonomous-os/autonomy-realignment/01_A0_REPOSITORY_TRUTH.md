# A0 Repository Truth

## Preflight

| Field | Value |
|-------|-------|
| Repository | Skyrunnerrr/deintarifheld |
| Worktree | `/Users/noahbez/WORKTREES/dth-a0-autonomy-realignment-001` |
| Branch | `audit/dth-a0-autonomy-realignment-001` |
| HEAD | `2195872af240e422da274f8b6cc19e4fc0fb3892` |
| Worktree | CLEAN at audit start |
| Node | v24.14.0 |
| npm | 11.9.0 |
| ENV filenames only | `.env.example` |

## Major components — classification

| Area | Status | Evidence level | Evidence |
|------|--------|----------------|----------|
| Public B2B landing | IMPLEMENTED | E2 | `app/`, `components/` |
| B2B lead intake POST | IMPLEMENTED | E2–E5 (docs claim E5) | `app/api/leads/route.js` |
| Validation | IMPLEMENTED | E2 | `lib/leads/validate-unternehmen.js` |
| Abuse/rate limit | PARTIALLY_IMPLEMENTED | E2 | `lib/leads/abuse-guard.js` in-memory per instance |
| Idempotency | IMPLEMENTED | E2 | leads supabase helpers |
| Lead persistence | IMPLEMENTED | E2/E5 docs | `public.leads` migration 001 |
| Lead audit | IMPLEMENTED | E2 | `public.audit_events` |
| Mail (Resend) | PARTIALLY_IMPLEMENTED | E2 | `lib/leads/mail.js` modes mock/internal_live/live |
| Public retention cron | IMPLEMENTED | E2 | `vercel.json` → `/api/cron/retention` |
| Dual-plane architecture | DESIGNED + PARTIAL | E1/E2 | docs + `packages/*` skeletons |
| Ops BFF writes (local) | LOCAL_ONLY | E2/E3 | `packages/ops-api` |
| Cases/tasks/approvals schema | DRAFT / ARCHIVED | E1/E2 | `packages/db/migrations/drafts`, archive |
| Transactional outbox claim | LOCAL_ONLY PARTIAL | E2/E3 | `packages/db/src/outbox-claim.js` |
| Continuous worker loop | NOT_IMPLEMENTED | E2 | `packages/workers/src/one-shot-runner.js` flags = NO |
| Scheduler / retry / DLQ / reprocess | NOT_IMPLEMENTED | E2 | same explicit NO flags |
| Workflow engine | NOT_IMPLEMENTED | E1/E2 | empty `workflow` schema shell M11E staging only |
| Agent runtime | NOT_IMPLEMENTED | E1 | ADR-012 future; Zone H future |
| Kill switch durable | NOT_IMPLEMENTED | E2 | in-memory `packages/ops-api/src/kill` |
| CONTROL_VERSION | DOCUMENTED_ONLY | E1 | ADR-026 / M11O; no package symbol |
| Command Center | LOCAL_ONLY READ_ONLY | E2 | `packages/cc` |
| Qualification / inbound reply / follow-up engines | NOT_IMPLEMENTED | E2 | no runtime |
| Calendar / documents / tariff / offer / switching / renewal engines | NOT_IMPLEMENTED | E2 | no runtime |
| Content/social automation | NOT_IMPLEMENTED | E1 | deferred in plan §23 |
| Acquisition automation | NOT_IMPLEMENTED | E2 | form intake only |

## Worker stub quote

`packages/workers/src/one-shot-runner.js`:

```text
P3-F5 one-shot local worker stub — no loop, no scheduler, no retry engine.
CONTINUOUS_LOOP_IMPLEMENTED=NO
SCHEDULER_IMPLEMENTED=NO
AUTOMATIC_RETRY_IMPLEMENTED=NO
DEAD_LETTER_IMPLEMENTED=NO
REPROCESS_IMPLEMENTED=NO
PRODUCTION_EXACTLY_ONCE_GUARANTEE=NO
```

## Active supabase migrations (apply root)

1. `001_leads_phase_a.sql` — leads, audit_events
2. `002_leads_phase_b.sql` — career + mail columns
3. M11E private schema default privileges
4. M11E global routine default hardening

**No** cases/tasks/outbox/workflow tables in active apply root.
