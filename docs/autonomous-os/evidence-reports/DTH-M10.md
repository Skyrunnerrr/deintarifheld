# DTH-M10 — Canonical Data & Source-of-Truth Architecture

```text
TRANCHE=DTH-M10
DATE=2026-08-13
BASELINE_HEAD=0702fab0a00a6dde24b88963b78cf6f0d16590c4
M9F=PASS
M6=OPEN (unchanged)
STATUS=PASS (architecture documentation; pending M10R + Owner + M10F before implementation)
IMPLEMENTATION_EXECUTED=NO
COMMIT_CREATED=NO
PUSH_EXECUTED=NO
```

## Pre-flight

```text
HEAD=0702fab0a00a6dde24b88963b78cf6f0d16590c4
BRANCH=feat/deintarifheld-production-cutover-001
WORKTREE=CLEAN (at start)
SOURCE_CODE_CHANGED=NO
CONFIG_CHANGED=NO
M10_PRE_FLIGHT=PASS
```

## Binding inputs consumed

M9F Evolutionary Dual-Plane frozen. Hard platform facts:

- `service_role` / privileged secret keys → `BYPASSRLS` (RLS does not protect that path)
- GRANTs ≠ RLS (separate layers)

## Selected topology

```text
DATA_TOPOLOGY_ID=DTH-DT-A
DATA_TOPOLOGY_NAME=Single Postgres Project — Physically Segmented Runtime Domains
```

### Weighted scorecard (0–5)

Weights sum = 100.

| Criterion | W | A Dual-domain 1-project | B Separate projects | C Same-schema role-only end |
|---|---:|---:|---:|---:|
| SECURITY | 8 | 4 | 5 | 3 |
| LEAST_PRIVILEGE | 8 | 5 | 5 | 3 |
| RLS/GRANT CLARITY | 7 | 5 | 5 | 3 |
| SERVICE-CREDENTIAL BLAST RADIUS | 8 | 4 | 5 | 3 |
| PUBLIC→OPS DURABILITY | 8 | 5 | 4 | 5 |
| TRANSACTIONAL ATOMICITY | 7 | 5 | 2 | 5 |
| PRIVACY SEPARATION | 5 | 3 | 5 | 2 |
| OPERATIONAL COMPLEXITY (invert: higher=simpler) | 6 | 4 | 2 | 5 |
| MIGRATION RISK (invert) | 7 | 4 | 2 | 5 |
| RECOVERY | 4 | 4 | 3 | 4 |
| BACKUP | 3 | 4 | 3 | 4 |
| MONITORING | 3 | 4 | 3 | 4 |
| COST | 3 | 4 | 2 | 5 |
| TESTABILITY | 4 | 4 | 3 | 4 |
| STAGING PARITY | 4 | 4 | 3 | 4 |
| DEBUGGABILITY | 4 | 4 | 3 | 5 |
| CURRENT CODE REUSE | 6 | 5 | 2 | 5 |
| FUTURE WORKFLOW | 4 | 5 | 4 | 4 |
| FUTURE AGENT SAFETY | 5 | 5 | 5 | 3 |
| SMALL-TEAM OPERABILITY | 6 | 5 | 2 | 4 |
| **WEIGHTED TOTAL** | | **447** | **355** | **388** |

Scores = weight × rating. A = 447, C = 388, B = 355.

### Sensitivity

- If PRIVACY SEPARATION weight → 12 and BLAST → 12: A still leads unless separate legal mandate forces B.
- If MIGRATION RISK dominates alone: C wins short-term — retained as TRANSITION_A, not end-state.
- B selected only with evidence that single-project blast radius is unacceptable.

**No score manipulation:** A wins on durability+reuse+operability; B wins pure isolation; C wins short-term migration ease.

## Security red-team (architecture)

| Attack / failure | Mitigated by architecture? | Residual |
|---|---|---|
| Public credential reads all leads | Target PUBLIC_INTAKE no broad SELECT | Until cutover, current service_role = OPEN risk |
| Public accesses Ops | No grants on Ops objects | Implementation required |
| Ops API bypasses App AuthZ via DB | Grants+RLS still least-privilege; App AuthZ mandatory | Defense in depth |
| Worker enumerates customers | Constrained WORKER grants + AuthZ | Implementation |
| Agent as DB principal | No DB role for agent | Must enforce in deploy |
| service_role bypasses RLS | Explicit: BYPASSRLS; retire from normal path | Until retirement OPEN |
| Spoof person_id | Mapping server-side; App AuthZ | Implementation |
| Duplicate event → duplicate case | idempotency_key + inbox receipt | Implementation |
| Restore resends mail | provider refs + idempotency + final control | Implementation |
| Stale job after takeover | CONTROL_VERSION check | Implementation |
| Kill ignored | Durable control + fail-closed last-mile | Implementation |
| Audit rewrite by runtime | INSERT-only audit grants | Implementation |
| Staging→prod | Env isolation invariants | Process |
| Deletion misses DLQ/traces | Deletion graph + minimization | Implementation + legal |

**Architecture-rejecting CRITICAL after design:** NONE (implementation gaps remain risks, not topology rejects).

## Technical privacy review

**Strengths:** minimization classes; no agent/CC DB; append-only audit intent; staging without prod PII; deletion graph; separate career vs lead.

**Risks:** current service_role; payload jsonb on leads may hold PII copies; dual audit stores need classification; backups contain PII.

**Legal dependencies:** retention durations, marketing vs transactional bases, DSAR timelines — LEGAL_REVIEW_REQUIRED. **Not claiming GDPR_COMPLIANT=true.**

## Overengineering review

Rejected: premature dual DB, event sourcing platform, BPMN engine, vector DB, CQRS warehouse, excessive schemas on day one. Prefer role separation first (TRANSITION_A), optional physical schemas later.

## Operational simplicity

One engineer can locate SoT via `06_DATA_ARCHITECTURE.md` + ADR-018 registry; handoff replay via outbox; single migration root.

## Acceptance checklist

All M10 acceptance items in master prompt §76 addressed in `06_DATA_ARCHITECTURE.md` + this report + ADR-017…032.

```text
M10=PASS
REASON=Topology selected; SoT/roles/grants/RLS/handoff/retention/migration authority defined; red-team no architecture reject; no implementation/commit.
```

## Next

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M10R_PRINCIPAL_DATA_SECURITY_REVIEW
COMMIT=NO
PUSH=NO
M11=NOT_STARTED
```

## M10R HARDENING NOTE

M10 provisional decisions retained under DTH-DT-A. Binding hardenings in DTH-M10R / ADR-033 / ADR-034. Not frozen until M10F. No implementation.

## M10F FREEZE NOTE

STATUS remains PASS. Frozen by DTH-M10F. No reinterpretation. Implementation gaps remain OPEN until authorized later tranches.
