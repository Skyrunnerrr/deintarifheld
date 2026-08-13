# Architecture (placeholder — ADR gate)

STATUS=E0_PENDING_M9  
RULE=No automation runtime until ARCHITECTURE_CANONICAL=PASS.  
PHASE4_BASELINE=see `docs/autonomous-os/evidence-reports/DTH-M8.md` (M8=PASS; architecture exit YES; implementation exit NO).

Open ADR set (required before agents/workflows):

- ADR-001 Public Web Canonical Location
- ADR-002 Public API Canonical Location
- ADR-003 Ops API Architecture
- ADR-004 Database Boundary
- ADR-005 Lead → Case Synchronisation
- ADR-006 Workflow Runtime
- ADR-007 Queue Technology
- ADR-008 AI Provider Architecture
- ADR-009 Communication Architecture
- ADR-010 Audit Architecture

Observed conflict to resolve:

```text
Public productive surface = repo root Next.js
packages/web + packages/api = skeletons
Ops/CC = packages/* local only
In-memory session/kill stores = must NOT be extended as production design
```
