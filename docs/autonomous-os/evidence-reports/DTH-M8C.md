# DTH-M8C — Canonical Phase-4 Baseline Freeze

STATUS=PASS  
AS_OF_UTC=2026-08-13T05:50:00Z  
PARENT=DTH-M8  
COMMITTED=YES_AFTER_THIS_TRANCHE  

## Purpose

Freeze M6/M7/M8 governance truth remotely without starting M9.

## Corrections applied

| Item | Result |
|---|---|
| H0b2a “Live secret” | Replaced: `H0B2A_SECRET_DEPENDENCY=NOT_REQUIRED`; gap = live authenticated Dev session/readback |
| RLS vs service role | Recorded as M9 design requirement; RLS ≠ service-role protection |
| In-memory session/kill | Explicit LOCAL_DEVELOPMENT_ONLY; not production-suitable |
| Dual runtime | Root public vs packages Ops — M9 ADR input |
| Dual migrations | Public 001–002 vs Ops 003–013 + drafts — M9/M10 decision |
| Phase status fields | Normalized to independent PHASE4_* fields |
| M6 | Remains OPEN |

## Normalized Phase-4 status

```text
PHASE4_LOCAL_FOUNDATION=PASS
PHASE4_REMOTE_DEV_EVIDENCE=PARTIAL
PHASE4_STAGING_READY=NO
PHASE4_PRODUCTION_READY=NO
PHASE4_EXIT_TO_ARCHITECTURE_ALLOWED=YES
PHASE4_EXIT_TO_IMPLEMENTATION_ALLOWED=NO
PHASE4_EXIT_TO_STAGING_ALLOWED=NO
PHASE4_EXIT_TO_PRODUCTION_ALLOWED=NO
```

## M6 preservation

```text
M6=OPEN
OWNER_READBACK_PENDING=YES
BLOCKING_CLASS=BLOCKING_BEFORE_PRODUCTION_IDENTITY_CLOSURE
NON_BLOCKING_FOR_M9_DOCS=YES
```
