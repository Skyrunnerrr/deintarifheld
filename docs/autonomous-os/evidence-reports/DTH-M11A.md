# DTH-M11A — Database Migration & Access-Control Implementation Plan

```text
TRANCHE=DTH-M11A
DATE=2026-08-13
BASELINE_HEAD=c3b26a4f6e3c53b76c5bb71099f6900c5824fae8
M10F=PASS
M6=OPEN
STATUS=PASS (planning docs; Owner review; no SQL; no commit)
SQL_CREATED=NO
DB_MUTATION=NO
COMMIT_CREATED=NO
PUSH_EXECUTED=NO
```

## Pre-flight

```text
HEAD=c3b26a4f6e3c53b76c5bb71099f6900c5824fae8
BRANCH=feat/deintarifheld-production-cutover-001
WORKTREE=CLEAN (at start)
M11A_PRE_FLIGHT=PASS
```

## Production migration certainty

```text
PRODUCTION_MIGRATION_STATE=PARTIAL
```

Evidence: OS docs claim 001–002 E5; 002 file comment conflicts historically; 003–013 “not proven production”; no live probe in M11A; CI never remotes-migrates.

## Recommended next tranche

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M11B_PRODUCTION_MIGRATION_STATE_RECONCILIATION
WHY_THIS_IS_FIRST=Cannot safely plan/apply production DDL until apply-state is proven read-only.
```

### M11B template (first executable)

| Field | Content |
|---|---|
| ID | M11B |
| TITLE | Production Migration State Reconciliation |
| OBJECTIVE | Read-only prove which of 001–013 (and objects) exist on production Supabase |
| DEPENDENCIES | Owner accept M11A; Owner-authorized read-only credentials |
| IN SCOPE | schema fingerprint; migration history read; table existence; RLS enable flags; policy count; grants snapshot (names only) |
| OUT OF SCOPE | SQL apply; role create; grant change; RLS create; app changes |
| ALLOWED FILES | evidence report only (after Owner auth) |
| PRODUCTION_EFFECT | NONE (read-only) |
| RISK | Credential misuse if not read-only | 
| ROLLBACK | N/A |
| TESTS | Compare inventory to expected 001–002 vs 003–013 |
| EVIDENCE | E3 readback artifacts (no PII dumps) |
| ACCEPTANCE | PRODUCTION_MIGRATION_STATE upgraded to PROVEN or documented gaps with Owner decision |
| STOP | Any write attempted; unexpected secrets; PII dumps |
| NEXT | M11C Staging Environment Foundation |

## Critical paths

```text
CRITICAL_PATH_TO_STAGING=M11B→C→D→E→F→G→H→I→J→K→L→M→N→O→P
CRITICAL_PATH_TO_PUBLIC_INTAKE_CUTOVER=…→P→Q→R→T→S (+E5/E6)
```

## Plan red-team

Addressed: RLS lockout, owner/runtime confusion, Data API exposure, early service_role removal, intake breakage, pooler leak, dual-apply, insecure rollback, app/DB skew — mitigated by ordering, staging-first, hybrid schema, single write-path switch, gates.

## Acceptance

All M11A §70 criteria met in `07_IMPLEMENTATION_PLAN.md` + this report.

```text
M11A=PASS
REASON=Reality audited; PARTIAL prod migration classified; dependency graph + ordered tranches + critical paths + first tranche M11B read-only; no SQL/source/commit.
```

## Architecture reopen?

```text
ARCHITECTURE_REOPEN=NO
```

No contradiction with M9/M10F requiring redesign. Implementation choices (hybrid schema move timing; pooler mode) deferred to proof tranches without changing frozen contracts.

## M11ABF FREEZE NOTE

```text
M11A=PASS (planning)
PRODUCTION_MIGRATION_STATE superseded by M11B: PROVEN
PROD_DB_BASELINE_ID=DTH-PROD-DB-20260813-de5e6bd1ecf4
Frozen with DTH-M11ABF. No SQL. Next = M11C staging after Owner freeze acceptance.
```
