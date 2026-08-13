# DTH-M9F — Canonical Runtime Architecture Freeze

TRANCHE=DTH-M9F  
DATE=2026-08-13  
STATUS=PASS (post-commit gates)

## 1. Canonical architecture

```text
ARCHITECTURE_ID=DTH-ERA-A
ARCHITECTURE_NAME=Evolutionary Dual-Plane
ARCHITECTURE_DECISION_ROBUST=YES
ARCHITECTURE_FROZEN=YES
M9R=PASS
```

### Topology (target)

```text
PUBLIC PLANE
Root Next Public Runtime
├── Public Website
├── Public Intake API
└── constrained public-intake DB access
             │
             │ durable handoff
             ▼
OPS PLANE
packages/*
├── cc
├── ops-api
├── workers
├── shared
└── db
```

Canonical public runtime: `ROOT_NEXT`  
Canonical Ops runtime: `packages/cc`, `packages/ops-api`, `packages/workers`, `packages/shared`, `packages/db`  
Deprecation candidates (not deleted): `packages/web`, `packages/api`

## 2. M9R verdict

```text
M9R=PASS
ARCHITECTURE_DECISION_ROBUST=YES
No architecture-rejecting CRITICAL finding remains.
```

Binding hardenings frozen (not reinterpreted):
- Clerk vs DTH authority split (`CLERK_AUTHENTICATED != DTH_SESSION_ALLOWED`)
- Worker → Domain Service (no mandatory HTTP hairpin)
- No general-purpose service_role on normal public path (target)
- Public→Ops durable under same-DB or separate-DB topology
- Outbox intent before provider call
- Last-mile control check; stale-execution invalidation
- Postgres-first session/kill/workflow
- Audit = APPEND_ONLY_FOR_RUNTIME (not immutable)
- Agents untrusted; tools only; prompt ≠ security boundary

## 3. Consistency review

```text
M9F_CONSISTENCY_REVIEW=PASS
CORRECTIONS_REQUIRED=YES (pre-freeze)
CORRECTIONS_APPLIED=
- Merged M9R hardening stubs into canonical ADR-00N.md
- Removed duplicate long-named ADR stub files
- Fixed 02_ARCHITECTURE ADR links to ADR-00N.md
- ADR STATUS → ACCEPTED / ACCEPTED_WITH_M10_DEPENDENCY
- Control matrix architecture-vs-implementation normalization
- Risk register M9F normalization banner
- Decision log + current state + evidence index freeze entries
REMAINING_CONTRADICTIONS=NONE
```

## 4. Final vs M10-conditional decisions

### M9 FINAL

```text
dual-plane architecture
public root remains canonical
Ops packages canonical
separate CC deployable
Ops API boundary
worker domain-service path
agent tool boundary
Clerk vs DTH authority split
Postgres-first session registry
Postgres-first kill switch
Postgres-first workflow runtime
last-mile control requirement
stale-execution invalidation requirement
external-action outbox ordering
environment isolation model
audit classification model
service credential minimization principle
```

### M10 CONDITIONAL / REQUIRED

```text
same DB vs separate DB/project
schema boundaries
table ownership
canonical SoT
lead→case semantics
public→Ops detailed transaction topology
exact intake DB grants
RLS policy design
service/database roles
outbox tables
inbox/import semantics
control-version persistence
workflow persistence schema
retention
deletion propagation
audit field model
DLQ payload model
agent trace field model
data lineage
migration sequence
```

## 5. Architecture invariants

See `02_ARCHITECTURE.md` M9F CANONICAL INVARIANT SET (minimum required set present).

## 6. ADR status

| ADR | Decision | Status | M10 Dependency |
|---|---|---|---|
| ADR-001 | Canonical public = root Next | ACCEPTED | NO |
| ADR-002 | Canonical Ops packages | ACCEPTED | NO |
| ADR-003 | Deployment boundary public/ops | ACCEPTED | NO |
| ADR-004 | Public→Ops durable handoff | ACCEPTED_WITH_M10_DEPENDENCY | YES (topology) |
| ADR-005 | DB access boundary | ACCEPTED | NO |
| ADR-006 | Credential boundary | ACCEPTED_WITH_M10_DEPENDENCY | YES (exact grants) |
| ADR-007 | Durable session (Postgres) | ACCEPTED | NO |
| ADR-008 | Durable kill switch (Postgres) | ACCEPTED | NO |
| ADR-009 | Workflow Postgres+worker | ACCEPTED | NO |
| ADR-010 | Agent execution boundary | ACCEPTED | NO |
| ADR-011 | Ops API / domain-service paths | ACCEPTED | NO |
| ADR-012 | Environment isolation | ACCEPTED | NO |
| ADR-013 | External action outbox ordering | ACCEPTED | NO |
| ADR-014 | Human takeover / escalation | ACCEPTED | NO |
| ADR-015 | Audit append-only-for-runtime | ACCEPTED | NO |
| ADR-016 | Migration boundary | ACCEPTED_WITH_M10_DEPENDENCY | YES (schemas/migrations) |

## 7. Unresolved implementation risks

- M6 historical identity evidence (OWNER_READBACK_PENDING)
- Current broad service_role
- Missing persistent person mapping
- Missing strong AuthZ
- Missing RLS policies
- In-memory session/kill controls
- No staging
- M10 data topology unresolved (conditional)
- Monitoring/audit/recovery incomplete
- Workflow durability / stale-execution not implemented

## 8. Hygiene

```text
M9F_SECRET_SCAN=PASS
M9F_PII_SCAN=PASS
RAW_SECRET_EXPOSURE=NO
RAW_PRODUCTION_PII_EXPOSURE=NO
```

## 9. Commit / safety / remote

```text
COMMIT_SHA=(git tip of this freeze commit; identity = safety branch tip)
REMOTE_SAFETY_BRANCH=safety/dth-m9-canonical-<shortsha> (created at push from freeze tip)
REMOTE_BACKUP_VERIFIED=PASS_REQUIRED_AT_PUSH (see gate output)
```

## 10. M6 preservation

```text
M6=OPEN
OWNER_READBACK_PENDING=YES
BLOCKING_CLASS=BLOCKING_BEFORE_PRODUCTION_IDENTITY_CLOSURE
```

## 11. M10 entry contract (record only — NOT executed)

```text
M10_ENTRY_ALLOWED=YES (iff M9F=PASS)
```

M10 must consume constraints listed in master prompt §25.
