# P3-F6 — Kill-Switch Control Foundation

TRANCHE=P3-F6  
LOCAL_DEV_ONLY=YES  
PRODUCTION_WIRING=NO  
DATABASE_REQUIRED=NO  
MIGRATIONS_AUTHORIZED=NO  
STRONG_AUTHZ_COMPLETE=NO  
PRODUCTION_AUTHZ_READY=NO  
AVERION_KILL_SWITCH_AUTHORITY=NO  

## Sequence note

Owner decision: mandatory pack ORDER takes precedence over dependency-column alone.  
`P3_F2A_EXECUTED_BEFORE_P3_F6=ACCEPTED_CONTROLLED_SEQUENCE_DEVIATION` — no F2a rollback.  
`P3_F2B_BEFORE_P3_F6_AUTHORIZED=NO`.

## Semantics

| State | Meaning |
|---|---|
| `ACTIVE` | Domain is blocked/paused by kill override |
| `INACTIVE` | No kill override is active |

`KILL_STATE_INACTIVE` does **not** authorize capabilities.

```text
CAPABILITY_ENABLED =
  OWNER_AUTHORIZATION
  AND POLICY_GATE
  AND NOT KILL_STATE_ACTIVE
```

P3-F6 does not implement capability activation.

## Eight domains

1. PUBLIC_INTAKE  
2. API_PROCESSING  
3. INTERNAL_MAIL  
4. MARKETING_MAIL  
5. AUTOMATION_ENGINE  
6. DATA_IMPORT  
7. PARTNER_ACCESS  
8. COMMAND_CENTER_WRITE_ACTIONS  

## Local/dev defaults

- PUBLIC_INTAKE / API_PROCESSING / INTERNAL_MAIL → `INACTIVE`  
- MARKETING_MAIL / AUTOMATION_ENGINE / DATA_IMPORT / PARTNER_ACCESS / COMMAND_CENTER_WRITE_ACTIONS → `ACTIVE`  

Not wired to public runtime in this tranche.

## Authority

- Primary: synthetic local Owner person (`person_synth_owner_dth_local_001`) via P3-F1 person CC session  
- Rejected: non-Owner person, service, break-glass, shared-secret context, missing/unknown principal  
- Averion: no kill authority  

## Persistence

`PERSISTENCE_ADAPTER=LOCAL_DEV_ONLY` (in-memory).  
No Supabase/Postgres/migrations/remote DB.

## Packages

- `packages/shared` — domains, state, defaults, invariant helper  
- `packages/ops-api` — Owner-only command service + audit log  
- `packages/cc` — read-only status contract/adapter (no UI)  
