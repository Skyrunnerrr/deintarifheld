# A1 Baseline and Reuse Map

## Baseline

- Repository: Skyrunnerrr/deintarifheld
- A0 HEAD: `75c4c6067cebb178faf6c9e0c50c7e644d249f5e`
- Branch: `feat/dth-a1-durable-workflow-runtime-001`
- Dependencies: `npm ci` (lockfile)
- Node 24.x / npm 11.x

## EXISTING / REUSE / EXTEND / SUPERSEDE / DO_NOT_USE

| Component | Disposition |
|-----------|-------------|
| `transactional_outbox` | REUSE as event handoff; synthetic ingest only in A1 |
| `claimOneSyntheticNoop` / one-shot runner | REUSE for outbox stub tests; NOT the A1 continuous motor |
| `evaluateWorkerMayProcess` | REUSE activation gate |
| Kill domains / KillState shared contracts | REUSE registry; EXTEND with durable `security.control_state` |
| ops-api in-memory kill | DO_NOT_USE as A1 authority (still exists for local CC; A1 uses Postgres) |
| `createLocalOutboxPool` | REUSE remote-URL refuse |
| Deny-all effect adapter | REUSE |
| Temporal / Redis / BullMQ | DO_NOT_USE |
| Draft ops migrations outside `supabase/migrations` | DO_NOT_USE as apply root |
