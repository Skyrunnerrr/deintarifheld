# DTH-M9R — Principal Architecture Red-Team & Hardening Review

STATUS=PASS  
AS_OF_UTC=2026-08-13T06:45:00Z  
SELECTED_ARCHITECTURE=DTH-ERA-A Evolutionary Dual-Plane  
ARCHITECTURE_DECISION_ROBUST=YES  
COMMITTED=NO  
M10_AUTHORIZED=NO  

## Executive verdict

```text
M9R=PASS
SELECTED_ARCHITECTURE=DTH-ERA-A
ARCHITECTURE_DECISION_ROBUST=YES
```

DTH-ERA-A survives adversarial review **after** documentation hardening below. No architecture-rejecting risk found that forces Option B/C. Material corrections are required before freeze (not a redesign).

---

## 1. Pre-Flight

```text
HEAD=4545c7b95ede83c952b7086f8073b19b747f20af
BRANCH=feat/deintarifheld-production-cutover-001
WORKTREE=DIRTY_GOVERNANCE_ARCHITECTURE_ONLY
SOURCE_CODE_CHANGED=NO
M9R_PRE_FLIGHT=PASS
```

---

## 2. Source-of-truth / authority model

| Object | AUTHORITATIVE | SECONDARY/CACHE | Conflict resolution |
|---|---|---|---|
| Identity (who is the human) | Clerk | DTH person mapping | Mapping fail-closed if unknown |
| Provider session existence | Clerk | — | Provider revoke is Clerk’s |
| DTH session admission / local policy | **DTH Postgres registry** | — | Local deny wins immediately |
| Authorization / capabilities | **DTH AuthZ** | — | Deny by default |
| Public lead record | Public intake DB | Ops copy/projection | Public SoT until M10 defines sync semantics |
| Ops case / workflow state | Ops DB | — | Ops wins |
| Kill switch | **DTH control store (Postgres)** | optional cache with TTL + revalidate | Fresh check before external action |
| External delivery state | DTH communication + provider IDs | Provider dashboard | Reconciliation required |
| Calendar event | Provider + DTH reference | — | Provider for schedule facts; DTH for case link |
| Audit trail | DTH audit store | logs | Runtime append-only; admin mutable unless upgraded |

**Finding F-01 (HIGH, fixed in docs):** M9 risked dual session “truth”. Corrected: Clerk ≠ DTH policy authority.

---

## 3. Clerk / DTH session authority

```text
CLERK_AUTHORITY=identity + authentication + provider session lifecycle (create/revoke at IdP)
DTH_SESSION_AUTHORITY=DTH admission, inactivity, max lifetime, max-one DTH session, local revocation, disablement enforcement
```

| Concern | Owner |
|---|---|
| Identity / AuthN | Clerk |
| Provider session | Clerk |
| DTH session admission | DTH registry |
| Inactivity / max lifetime (DTH policy) | DTH registry |
| Max-one DTH session | DTH registry (atomic) |
| Local revocation | DTH immediate DENY |
| Provider revoke | Clerk follow-up (async OK) |
| User disablement | DTH deny + Clerk disable propagation |

**Invariant:** `CLERK_AUTHENTICATED` does **not** imply `DTH_SESSION_ALLOWED` / authorized.  
**Failure:** If DTH says revoked/disabled → **DENY now**, even if Clerk API unreachable.

---

## 4. Ops API / Domain Service boundary

Compared A (everything via HTTP Ops API), B (CC/Agent via API; Worker → Domain Service), C (other).

**Decision (hardened):**

```text
CANONICAL_DOMAIN_SERVICE_BOUNDARY=shared domain services (packages/shared + ops domain modules) owning policy-equivalent business logic
CANONICAL_TRANSPORT_BOUNDARY=
  CC → Ops API (HTTP) → Domain Service
  Agent → Tool Gateway → Ops API → Domain Service
  Worker → Domain Service (in-process / same trust zone) — NOT required to hairpin HTTP
```

Workers remain trusted backend principals with **same AuthZ/audit/final-control rules** as API path. Agents **must** stay behind tools/API.

**Finding F-02 (HIGH, fixed):** M9 overcoupled workers to HTTP.

---

## 5. Service-role / DB privilege

```text
NO_GENERAL_PURPOSE_SERVICE_ROLE_IN_NORMAL_PUBLIC_REQUEST_PATH=TARGET_INVARIANT
```

```text
PUBLIC_INTAKE_MAXIMUM_CAPABILITY_SET=
  MAY: validate request; insert permitted intake/lead row; insert associated source-outbox row (same txn if same DB); write intake audit event
  MUST NOT: enumerate/read arbitrary leads; update/delete arbitrary rows; access ops/audit/identity/workflow/kill tables; bypass to case mutations
```

Three controls remain distinct: **APPLICATION_AUTHZ**, **DATABASE_GRANTS**, **DATABASE_RLS**, plus explicit **PRIVILEGED_SERVICE_PATH** (migration/break-glass only).

---

## 6. Public→Ops atomicity (M10-compatible)

```text
HANDOFF_PATTERN=DURABLE_PUBLIC_INTAKE_THEN_ASYNC_OPS_INGEST
DATA_TOPOLOGY_DEPENDENCY=CONDITIONAL_ON_M10
```

| M10 topology | Guarantee |
|---|---|
| **Same transactional DB** | `lead + source_outbox` **SAME_TRANSACTION** |
| **Separate DB/projects** | Public durable write + public source outbox → **relay** → Ops **idempotent inbox** (no distributed XA) |

M9 does **not** require same DB. M10 chooses topology; handoff pattern stays valid.

**Finding F-03 (HIGH, fixed):** M9 implied single-DB outbox atomicity.

---

## 7. Corrected external-action / outbox pattern

**Canonical:**

```text
Command
→ Policy/AuthZ
→ Domain Transaction (business state + outbox intent)
→ COMMIT
→ Dispatcher
→ Provider Adapter
→ Provider
→ Provider result / webhook
→ Reconciliation
```

Provider call **must not** precede durable intent. Adapter may format after commit/dispatch.

**Semantics:**

```text
INTERNAL_JOB_PROCESSING_SEMANTICS=AT_LEAST_ONCE_WITH_LEASES
EXTERNAL_EFFECT_SEMANTICS=AT_LEAST_ONCE_PLUS_IDEMPOTENCY_AND_RECONCILIATION
IDEMPOTENCY_REQUIREMENT=MANDATORY for external effects
RECONCILIATION_REQUIREMENT=MANDATORY for mail/calendar/social
```

No exactly-once delivery claim.

---

## 8. Last-mile control check

```text
CLAIM → PREPARE → FINAL_CONTROL_CHECK → EXTERNAL_ACTION
```

Final check includes (as relevant): kill switch, workflow active, human takeover, execution freshness/generation, lease ownership, policy/AuthZ, suppression, idempotency.

```text
NO_EXTERNAL_ACTION_WITHOUT_FRESH_CONTROL_CHECK
If control store unreadable → NO SEND for risky automation (FAIL_CLOSED)
```

---

## 9. Human takeover / stale execution

```text
STALE_EXECUTION_PROTECTION_PATTERN=CONTROL_VERSION / WORKFLOW_GENERATION / EXECUTION_EPOCH
```

Takeover/cancel/supersede bumps generation. Before external action: `job.generation == current.generation` else `CANCEL_STALE_EXECUTION`. Persistence details → M10.

```text
HUMAN_TAKEOVER_INVALIDATES_STALE_AUTOMATION
```

---

## 10. Kill-switch failure behavior

| Domain | Mode |
|---|---|
| Public intake | CONTINUE (independent of kill store) |
| Internal Ops read | DEGRADED_SAFE |
| Customer transactional mail | FAIL_CLOSED |
| Marketing mail | FAIL_CLOSED |
| Calendar mutation | FAIL_CLOSED |
| Agent action | FAIL_CLOSED |
| Partner API write | FAIL_CLOSED |

Claimed-but-unsent work: no fresh check → **no send**.

---

## 11. Session registry concurrency

Required properties (Postgres-capable with row locks / single-row upsert patterns; no SQL in M9R):

```text
ATOMIC_SESSION_ADMISSION
ATOMIC_REPLACEMENT (REVOKE_OLD_ALLOW_NEW)
DURABLE_REVOCATION
MULTI_INSTANCE_CONSISTENCY
```

Decision **not** reopened: Postgres remains suitable.

---

## 12. Postgres workflow review

```text
POSTGRES_FIRST=ACCEPT
```

V1 needs: durable jobs, multi-consumer claim (`FOR UPDATE SKIP LOCKED` class), lease, retry/backoff, DLQ, schedule, timeout, cancel, idempotency, reconciliation — all conceptually feasible.

```text
QUEUE_UPGRADE_TRIGGERS=
  sustained claim latency / queue depth harming SLOs
  DB lock contention or CPU/IO dominated by job tables
  long-running workloads starving OLTP
  need for cross-region queue isolation
  operational need to scale workers independent of primary DB
```

No fake numeric thresholds; measure in staging/prod.

---

## 13. Audit architecture review

```text
V1_AUDIT_LEVEL=APPEND_ONLY_FOR_RUNTIME
NOT=CRYPTOGRAPHICALLY_IMMUTABLE
```

Runtime: no UPDATE/DELETE on audit. Separate writer grants. Correlation IDs. Break-glass audited. DB admins may still mutate → do **not** market as immutable.

| Class | Audit write fails |
|---|---|
| SECURITY_CRITICAL_AUDIT | Action **FAIL** (deny) |
| BUSINESS_AUDIT | Prefer fail or durable retry queue — default **FAIL** for external actions |
| OBSERVABILITY_LOG | Best-effort / retry |

---

## 14. Agent red-team

| Attack | Boundary answer |
|---|---|
| Arbitrary tool args | Schema validation + AuthZ on resource |
| Prompt injection | Untrusted input; no capability from prompt |
| Hidden endpoint | Network allowlist; no direct adapter |
| Foreign person ID | Principal from auth context only |
| Capability escalation | Server capability matrix |
| Broad dataset pull | Tool data minimization |
| Skip final control | Required in adapter/dispatcher |
| Direct provider | Credentials not in agent env |
| Secret via errors | Redacted errors; no secret echo |

**Safety must not depend on system prompt alone.** Prompt-only safety = FAIL (none relied upon).

---

## 15. CC boundary review

Separate CC deployable **ACCEPTABLE**: no DB/service_role/provider admin; Ops API only; server AuthZ. Extra deploy cost accepted for blast-radius vs Option C coupling. **Not reopened.**

---

## 16. Environment isolation

```text
NO_PRODUCTION_DB_CREDENTIAL_IN_STAGING
NO_PRODUCTION_CLERK_SECRET_IN_STAGING
NO_PRODUCTION_PROVIDER_SEND_CREDENTIAL_IN_TEST
NO_PRODUCTION_PII_REQUIRED_FOR_STAGING
```

Staging outbound mail/calendar → sandbox/allowlist only.

---

## 17. Data minimization

```text
AUDIT_DATA_MINIMIZATION=REFERENCE_BY_ID_WHERE_POSSIBLE
WORKFLOW_PAYLOAD_MINIMIZATION=YES
DLQ_DATA_MINIMIZATION=YES
AGENT_TRACE_MINIMIZATION=YES
```

Exact fields/retention → M10/governance.

---

## 18. Score sensitivity

Method: rescale criterion scores × scenario weight multipliers; drop criteria as specified; compare totals.

| Scenario | Winner |
|---|---|
| 1 Original | A |
| 2 Security/least-privilege +20% | A (margin ↑) |
| 3 Ops simplicity +20% | A |
| 4 Migration risk weight ↓ | A (still ahead; B closes slightly) |
| 5 Remove CURRENT_CODE_REUSE | A |
| 6 Remove TEAM_SIZE | A |

```text
ARCHITECTURE_DECISION_ROBUST=YES
```

Dominant drivers: migration/downtime risk of B, trust-zone coupling of C — not “reuse aesthetics”.

---

## 19. Dual-plane operating cost

```text
DUAL_PLANE_OPERATIONAL_COST=MEDIUM
ACCEPTABLE=YES
```

Duplicated: deploy, secrets, monitoring, CI — acceptable vs security isolation and “public stays up when Ops burns”. Revisit only if team cannot operate two planes after staging experience.

---

## 20. Shared package boundary

```text
SHARED_PACKAGE_ALLOWED=schemas, domain types, error/policy contracts, correlation IDs, pure validators
SHARED_PACKAGE_FORBIDDEN=DB clients with secrets, provider SDKs with keys, framework-specific Next/Express wiring, runtime secret loading
```

---

## 21. Failure recovery walkthrough

| Scenario | Loss | Dup risk | Recovery |
|---|---|---|---|
| A Worker crash post-accept | No | Low | Reclaim outbox |
| B Dispatcher crash | No | Low | Replay outbox |
| C Provider timeout after accept | No | **High without idempotency** | Idempotent key + reconcile |
| D Success, no webhook | No | Med | Poll/reconcile |
| E Takeover during prepare | No | Low | Generation mismatch → cancel |
| F Kill during prepare | No | Low | Final check fail-closed |
| G Ops API down | No (public) | — | Intake continues; Ops lag |
| H Clerk down | No | — | Public OK; Ops login fail |
| I DB blip | Possible in-flight | — | Client retry; RPO via backup |
| J Malicious AI output | No if schema/policy | — | Reject invalid tool output |

No **silent unrecoverable lead loss** if intake commit succeeded — **WORKER_FAILURE_MUST_NOT_LOSE_ACCEPTED_LEAD**.

---

## 22. M9 final vs conditional on M10

**FINAL_M9:** Dual-plane; public root; Ops packages; CC separate; domain service vs transport; Clerk vs DTH authority; last-mile check; generation/takeover; kill fail modes; Postgres-first + upgrade triggers; outbox-before-provider; agent tool boundary; env isolation; audit append-only-for-runtime.

**CONDITIONAL_ON_M10:** Same-DB vs dual-DB handoff mechanics; exact grants/RLS SQL; schema of outbox/generation columns; migration SQL; retention; lead→case field mapping.

---

## 23. Hardened invariants (additions)

```text
NO_EXTERNAL_ACTION_WITHOUT_FRESH_CONTROL_CHECK
HUMAN_TAKEOVER_INVALIDATES_STALE_AUTOMATION
PROVIDER_CALL_MUST_NOT_PRECEDE_DURABLE_INTENT
NO_GENERAL_SERVICE_ROLE_FOR_AGENT
NO_GENERAL_SERVICE_ROLE_FOR_CC
PUBLIC_INTAKE_HAS_MINIMUM_DB_CAPABILITY
AUDIT_MUST_NOT_BE_DESCRIBED_AS_IMMUTABLE_UNLESS_PROVEN
AUTH_PROVIDER_STATE_AND_DTH_POLICY_STATE_HAVE_EXPLICIT_AUTHORITIES
WORKER_FAILURE_MUST_NOT_LOSE_ACCEPTED_LEAD
PROVIDER_TIMEOUT_MUST_NOT_CAUSE_BLIND_DUPLICATE_RETRY
M10_DATA_TOPOLOGY_MUST_PRESERVE_DURABLE_PUBLIC_TO_OPS_HANDOFF
CLERK_AUTHENTICATED_DOES_NOT_IMPLY_DTH_SESSION_ALLOWED
WORKER_USES_DOMAIN_SERVICE_NOT_REQUIRED_HTTP_HAIRPIN
```

---

## 24. Finding register

| ID | Sev | Area | Description | M9 change | M10? | Rejecting? |
|---|---|---|---|---|---|---|
| F-01 | HIGH | Session | Dual authority risk Clerk/DTH | Docs/ADR-007 | No | No |
| F-02 | HIGH | Worker | Forced HTTP hairpin | Docs/ADR-011 | No | No |
| F-03 | HIGH | Handoff | Assumed same-DB atomicity | Docs/ADR-004 | Yes topology | No |
| F-04 | HIGH | Outbox | Adapter-before-outbox ambiguity | Docs/ADR-013 | No | No |
| F-05 | HIGH | Automation | Missing last-mile check | Docs/invariants | Impl later | No |
| F-06 | HIGH | Takeover | Stale job send race | Docs/generation | Yes columns | No |
| F-07 | MED | Audit | “Immutable” overclaim risk | Docs/ADR-015 | Optional harden | No |
| F-08 | MED | Score | Numeric false confidence | Sensitivity done | No | No |
| F-09 | MED | service_role | Current prod bypass | Capability target | Grants | No |
| F-10 | LOW | Dual-plane cost | Ops overhead | Accepted | Observe | No |

No CRITICAL architecture-rejecting findings against DTH-ERA-A.

---

## 25. Required M9 documentation corrections

Applied in this tranche to: `02_ARCHITECTURE.md`, ADRs 004/007/011/013/015, `DTH-M9.md` note, this `DTH-M9R.md`, decision/risk/evidence indexes.

---

## 26. M9R Gate

```text
M9R=PASS
REASON=DTH-ERA-A survives red-team; score robust; corrections are hardenings not redesign; no rejecting risk; freeze recommended after Owner review (still no auto-commit).
```

---

## 27. Repository State

```text
SOURCE_CODE_CHANGED=NO
CONFIG_CHANGED=NO
COMMIT_CREATED=NO
PUSH_EXECUTED=NO
MERGE_EXECUTED=NO
DEPLOY_EXECUTED=NO
```

---

## 28. Recommended Next Action

```text
RECOMMENDED_NEXT_ACTION=FREEZE_M9_AFTER_OWNER_REVIEW
```

Next after Owner accept: **M9F** (commit + new safety branch + verify) → then M10.  
**M10 not started.**

## M9F FREEZE NOTE

STATUS remains PASS. Frozen by DTH-M9F. No reinterpretation. Implementation gaps remain OPEN until later tranches.
