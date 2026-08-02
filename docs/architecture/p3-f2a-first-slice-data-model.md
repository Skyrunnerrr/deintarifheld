# P3-F2a — First-Slice Data Model (Draft Only)

TRANCHE=P3-F2A  
DRAFT_ONLY=YES  
DO_NOT_APPLY=YES  
MIGRATION_APPLICATION_AUTHORIZED=NO  
STRONG_AUTHZ_COMPLETE=NO  
PRODUCTION_RLS_READY=NO  

## Purpose

Prüfbare additive SQL-/Migrationsentwürfe für den ersten Ops-/Command-Center-Slice — ohne Migration Apply, ohne DB-Start, ohne Remote.

## Canonical draft root

`packages/db/migrations/drafts/p3-f2a/`  
`DRAFT_ROOT_AUTO_APPLIED=NO` (Supabase consumes only `supabase/migrations/`)

## Domain model (ER text)

```text
leads (existing) ----< cases >---- career_applications (existing)
                         |
         +---------------+---------------+----------------+
         |               |               |                |
    case_notes         tasks      case_assignments   communication_events
                         |
                  task_reminders

cases/tasks ----< status_history (append)
ops_audit_events (separate from intake audit_events)
approval_requests ----< approval_decisions
transactional_outbox (no worker)
```

## Tables drafted

| Table | Soft delete | Notes |
|---|---|---|
| cases | yes | nullable refs to leads / career_applications |
| case_notes | yes | SoT `CASE_NOTE_RECORDED` |
| tasks | yes | foundation statuses only |
| task_reminders | yes | Wiedervorlagen; no dispatch |
| case_assignments | yes | `assigned_person_id` person-only |
| status_history | no (append) | foundation statuses |
| communication_events | yes | SoT IDs only |
| ops_audit_events | no (append) | P3-F1 actor-compatible; ≠ intake `audit_events` |
| approval_requests | no | no auto four-eyes |
| approval_decisions | no | person decider fields |
| transactional_outbox | no | idempotency_key; activation NO |

## Actor compatibility (P3-F1)

- Actor type strings: `PERSON_PRINCIPAL` \| `SERVICE_PRINCIPAL` \| `BREAK_GLASS_PRINCIPAL`
- Person columns (`*_person_id`) must not store service/break-glass ids
- Audit: `actor_type`, `actor_id`, `action`, `target_type`, `target_id`, `created_at`, `correlation_id`, `source`, `result`, `metadata_redacted`

## Security defaults (architecture rule — not Strong AuthZ)

- Browser direct access not granted
- Default-deny target; RLS enabled; no permissive policies; no `USING (true)`
- Revoke from `PUBLIC` / `anon` / `authenticated` in drafts
- No public grants
- No service-role-in-browser claim
- Full role matrix deferred

## Lexicon hygiene (J-F-05 partial)

- `FIRST_RESPONSE` = milestone only (not a stored comms/note entity)
- Store/emit SoT IDs only; aliases do not create tables/types
- Full J-F-05 closure remains P3-F3 / P3-F7

## Explicit non-scope

No commission / partner-pay / complete contract / TELESON / accounting / newsletter campaign / marketing send / customer confirmation tables or rules.

## F2b apply pointer

See evidence `18-rollback-and-f2b-apply-plan.md` after tranche close. F2b is **not** authorized by this document.
