# P3-F4 — Read-only Command Center UI (local/dev)

## Status

`AUTHORIZED_TRANCHE=P3-F4`  
`UI_MODE=READ_ONLY`  
`PRIMARY_VIEWS=INBOX,CASES,TASKS`  
`SUCCESS_FINAL_TOKEN=READY_FOR_NOAH_P3_F4_REVIEW`

## Purpose

Provide a local/dev DeinTarifHeld Command Center shell that consumes the P3-F3 Ops BFF read surface through a minimal loopback HTTP adapter under `/ops/v1`.

## Explicit non-goals

- No F3 limited-write UI
- No Kill / Approval / Audit screens
- No migrations, remote access, or deployment
- No production IdP / strong AuthZ / RLS changes
- No Averion coupling

## Architecture

1. **`@deintarifheld/ops-api`**  
   - Existing in-process BFF (`createOpsBff`)  
   - New `createLocalOpsHttpReadAdapter` — GET-only, loopback, fail-closed in production  
   - New read route `GET /ops/v1/inbox` projecting `leads` + `career_applications` (no inbox SoT table)  
   - Detail helpers: `GET /ops/v1/cases/:id/detail`, `GET /ops/v1/tasks/:id/detail`

2. **`@deintarifheld/cc`**  
   - Local HTML shell (German, desktop-first, responsive)  
   - Navigation exactly: Inbox · Vorgänge · Aufgaben  
   - Browser client issues **GET only** with `Authorization: DTH-Local <token>`  
   - Synthetic Owner session via `GET /ops/v1/dev/session` (AuthN bootstrap, not an F3 write)

3. **`@deintarifheld/shared`**  
   - Inbox projection helpers / redaction helpers

## AuthN boundary

- PERSON principal session required  
- Shared-secret / service / break-glass rejected  
- `STRONG_AUTHZ_COMPLETE=NO` · `PRODUCTION_IDP_READY=NO`

## Kill default during F4 tests

`COMMAND_CENTER_WRITE_ACTIONS=ACTIVE` remains the safe default. F4 does not perform writes, so no temporary deactivate is required.

## Evidence

`/tmp/dth-phase-3-implementation/p3-f4/`
