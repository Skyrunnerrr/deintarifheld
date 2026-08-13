# 06 — Canonical Data & Source-of-Truth Architecture

```text
TRANCHE=DTH-M10
STATUS=FROZEN_M10F
ARCHITECTURE_FROZEN=YES
DATA_ARCHITECTURE_FROZEN=YES
BASELINE_HEAD=0702fab0a00a6dde24b88963b78cf6f0d16590c4
ARCHITECTURE_ID=DTH-ERA-A (FROZEN M9F)
DATA_TOPOLOGY_ID=DTH-DT-A
DATA_TOPOLOGY_NAME=Single Postgres Project — Physically Segmented Runtime Domains
IMPLEMENTATION_AUTHORIZED=NO
COMMIT_AUTHORIZED=NO
```

## Binding platform facts

1. Supabase `service_role` / privileged secret API keys use a role with `BYPASSRLS`. **RLS does not protect that credential path.**
2. PostgreSQL **GRANTs** and **RLS** are separate layers: grants decide object reachability; RLS filters rows for roles that do not bypass RLS.
3. Therefore M10 designs **credential architecture + grants + RLS + application AuthZ**, not “add RLS policies” alone.

## 1. Current data reality (repo evidence)

| DATA_OBJECT | CURRENT_PATH | STORE | RUNTIME_OWNER | PROD? | LOCAL_ONLY? | SoT_TODAY | DUPLICATE? | TARGET_DECISION |
|---|---|---|---|---|---|---|---|---|
| LEAD | `public.leads` / `lib/leads` / `app/api/leads` | Postgres | Root Next API | YES (E5 docs) | NO | YES intake | NO | KEEP + constrain role |
| CAREER_APPLICATION | `public.career_applications` | Postgres | Root API careers | YES path | NO | YES | NO | KEEP separate |
| INTAKE_AUDIT | `public.audit_events` | Postgres | Root API | YES path | NO | Intake audit | ≠ ops audit | KEEP class |
| CASE | `public.cases` | Postgres | ops-api BFF | UNKNOWN remote | LOCAL_APPLY_ONLY | Ops work item | draft↔004 | Promote under authority |
| CASE_NOTE / TASK / ASSIGNMENT / STATUS_HISTORY | 005–008 | Postgres | ops-api | UNKNOWN | LOCAL_APPLY_ONLY | Ops | draft dup | Promote |
| COMMUNICATION_EVENT | 009 | Postgres | ops-api | UNKNOWN | LOCAL_APPLY_ONLY | Ops comms SoT | draft | Promote + refine |
| OPS_AUDIT | 010 | Postgres | ops-api | UNKNOWN | LOCAL_APPLY_ONLY | Ops audit | draft | Promote |
| APPROVAL | 011 | Postgres | ops-api | UNKNOWN | LOCAL_APPLY_ONLY | Ops | draft | Promote |
| TRANSACTIONAL_OUTBOX | 012 | Postgres | ops-api/worker | UNKNOWN | LOCAL_APPLY_ONLY | Outbox | draft | Promote + harden |
| PERSON_MAPPING | `packages/shared/.../person-mapping.js` | In-memory | shared | NO | YES | Temporary | — | Persist Postgres |
| SESSION_SECURITY | session-policy / provider-session | In-memory | shared/cc | NO | YES | Temporary | — | Persist Postgres |
| KILL_SWITCH | ops-api memory-store | In-memory | ops-api | NO | YES | Temporary | — | Persist Postgres |
| WORKFLOW / JOB | — | NONE | — | NO | — | NONE | — | New Postgres |
| ROLE/CAPABILITY | — | NONE | — | NO | — | NONE | — | New Postgres |
| packages/web+api | skeletons | N/A | none | NO | — | NOT canonical | — | Ignore |

**Observed:** RLS enabled on intake + Ops tables; **CREATE_POLICY_COUNT=0**. Intake path uses `SUPABASE_SERVICE_ROLE_KEY` via `lib/leads/supabase.js`. Ops local uses `pg` Pool (not service_role JWT).

## 2. Current migration reality

| MIGRATION_ID | PURPOSE | STATUS | APPLIED_LOCAL? | KNOWN_PRODUCTION? | DUPLICATED | TARGET_OWNER |
|---|---|---|---|---|---|---|
| 001_leads_phase_a | leads + audit_events | Public spine | Likely | YES (OS E5) | NO | PUBLIC_INTAKE |
| 002_leads_phase_b | lead cols + career + grants | Public spine; file comment “remote forbidden” vs OS E5 | Likely | Treat as prod-path from OS docs; apply-state not re-probed | NO | PUBLIC_INTAKE |
| 003–013 | Ops foundation | LOCAL_APPLY_ONLY | Local if applied | NOT proven production | Identical to packages/db drafts p3-f2a | OPS |
| packages/db drafts | Design pack | DO_NOT_APPLY | N/A | NO | Yes vs 003–013 | DESIGN_ONLY |

**Canonical apply root (decision):** `supabase/migrations/` only. Drafts never dual-applied.

## 3. Data principles (D1–D25)

All ACCEPTED. Highlights:

- D1 one SoT · D6 minimum public DB capability · D7 no unrestricted normal runtime DB · D8 RLS ≠ App AuthZ · D9 grants ≠ RLS · D10 BYPASSRLS exceptional · D11 accepted leads durable if Ops fails · D12 idempotent handoff · D13 durable intent before provider · D16 takeover invalidates stale work · D17–D19 minimize PII in audit/DLQ/traces · D20 staging without prod PII · D23–D24 evolutionary migration · D25 small-team comprehensibility.

## 4. Data classification (technical)

| CLASS | EXAMPLES | STORES | LOG? | AI? | STAGING? | EXPORT | RETENTION_CLASS |
|---|---|---|---|---|---|---|---|
| PUBLIC | marketing copy | CMS/static | YES | YES | YES | OK | EPHEMERAL/SHORT |
| INTERNAL | case status, task titles | Ops DB | YES redacted | LIMITED | synthetic | restrict | ACTIVE_CASE |
| PERSONAL | email, name, phone in lead | Intake/Ops | minimize | NO raw | synthetic only | DSAR | CUSTOMER_RECORD |
| SENSITIVE_OPERATIONAL | notes, offers | Ops | minimize | NO raw | synthetic | restrict | ACTIVE_CASE |
| SECURITY_SENSITIVE | session, kill, roles | Security domain | security audit | NO | synthetic | forbid | SECURITY_AUDIT |
| SECRET | API keys, DB URLs | secret manager | NEVER values | NO | separate | forbid | SECRET |
| AUDIT | audit_events / ops_audit | Audit stores | self | NO | synthetic | restrict | SECURITY_AUDIT / legal |
| DERIVED_AI | extractions | Ops + provenance | refs | YES marked | synthetic | restrict | SHORT/ACTIVE |
| EPHEMERAL | rate-limit counters | memory/cache | limited | NO | YES | N/A | EPHEMERAL |

No customer values in architecture docs.

## 5. Selected data topology

```text
DATA_TOPOLOGY_ID=DTH-DT-A
DATA_TOPOLOGY_NAME=Single Postgres Project — Physically Segmented Runtime Domains
```

**Rationale (evidence-backed):**

- Live public intake already on one Supabase project; Ops DDL (`cases.source_lead_id` FK → `leads`) assumes same DB.
- Same transactional boundary satisfies M9 durable handoff without XA.
- Separate projects (Option B) increase relay/ops complexity and migration risk for a small team without proven necessity.
- Same-schema-only forever (Option C end-state) underspecifies grant/RLS clarity; C remains **TRANSITION_A** reality.

| Boundary | Definition |
|---|---|
| PUBLIC_DATA_BOUNDARY | Intake objects: leads, career_applications, intake audit, public source outbox rows |
| OPS_DATA_BOUNDARY | cases and children, ops audit, approvals, workflow, communications |
| SECURITY_BOUNDARY | person mapping, session registry, roles/capabilities, kill/control |
| TRANSACTION_BOUNDARY | Same Postgres database (atomic intake+outbox) |
| FAILURE_BOUNDARY | Public intake survives Ops worker/CC outage |
| BACKUP_BOUNDARY | One primary DB backup unit; restore requires provider reconciliation |

### Options compared (summary)

| | A Single project dual domain | B Separate projects | C Same schema role-only |
|---|---|---|---|
| Atomic handoff | Strong | Needs relay | Strong |
| Blast radius | Shared DB | Split | Shared |
| Migration risk | Medium | High | Low short-term |
| Grant/RLS clarity | High (target) | High | Medium |
| Small-team ops | High | Lower | High short-term |
| Current FK reuse | Yes | Breaks/relays | Yes |

**Sensitivity:** Even if privacy-separation weight increases, A remains preferred for V1; B is exit option if measured blast-radius/compliance evidence appears. C is not rejected as transition.

## 6. Namespace ownership (logical)

| NAMESPACE | OWNER | WRITERS | READERS | RLS? | PRIVILEGED? | PUBLIC API? | BACKUP |
|---|---|---|---|---|---|---|---|
| PUBLIC_INTAKE | Public plane | PUBLIC_INTAKE role | OPS_API (controlled), WORKER (controlled) | YES | NO default | Intake API only | YES |
| OPS | Ops plane | OPS_API, WORKER | OPS_API (CC via API) | YES | NO | Ops API only | YES |
| SECURITY | Ops/security | OPS_API (session/kill services) | OPS_API | YES | exceptional only | NO browser | YES |
| WORKFLOW | Ops | WORKER, OPS_API | OPS_API | YES | NO | NO | YES |
| AUDIT | Split intake vs ops/security | AUDIT_WRITER / constrained writers | restricted readers | YES append | NO update/delete runtime | NO | YES |

TRANSITION_A may keep objects in `public` temporarily with strict grants; TARGET requires physical schemas (`intake`/`ops`/`security`/`workflow`/`audit`) with OPS/SECURITY/WORKFLOW/AUDIT not Data-API-exposed (M10R).

## 7. Canonical identifiers

All cross-plane IDs: UUID v4 (or ULID equivalent) — opaque, stable, not derived from email/phone/name, not reused.

| ID | Notes |
|---|---|
| intake acceptance | = `lead_id` or `career_application_id` after accept |
| lead_id / case_id / person_id / task_id / communication_id / thread_id | UUID |
| event_id / command_id / workflow_id / execution_id / job_id / approval_id / audit_event_id / agent_execution_id | UUID |
| provider_reference | external string + provider namespace |
| Human refs | `lead_ref`, `case_ref` unique display refs (not SoT keys) |

## 8. Intake vs Lead

**Decision:** Validation ephemeral → durable **LEAD** (energy) or **CAREER_APPLICATION** (career). No separate `intake_submission` table in V1. Spam may be durable with `status=spam` for ops review; hard rejects before insert leave no customer row (abuse logs only).

## 9. Lead → Case semantics

- Case **not** auto-created on every lead.
- Case created by Ops human or controlled automation with AuthZ + audit.
- Default: at most one **primary** open case per lead; additional cases require explicit link reason.
- Multiple submissions / one customer: deterministic match → EXACT_MATCH link, POSSIBLE_MATCH review, NO_MATCH new lead.
- Status separation:
  - `lead.status` — intake/sales triage of the lead record
  - `case.status` — operational work item
  - `workflow.status` — automation machine state
- Rejected/incomplete: remain lead without case or marked spam/deleted per retention.

## 10. Duplicate / matching

Deterministic only (no AI as canonical dedupe).

Signals: normalized email, phone (when present), idempotency_key, explicit customer ref.

Outcomes: `EXACT_MATCH` | `POSSIBLE_MATCH` | `NO_MATCH` | `MANUAL_REVIEW`.

Never silent field overwrite on match; merge via explicit operator/automation rules with provenance.

## 11. Provenance & unknown

Critical facts support: VALUE, SOURCE_TYPE, SOURCE_ID, OBSERVED_AT, RECORDED_AT, RECORDED_BY, VERIFICATION_STATE; AI adds AGENT_EXECUTION_ID, confidence, human verification.

Unknown ≠ false ≠ zero ≠ empty ≠ N/A — encode where business logic requires (prefer explicit enums / null + verification_state over inventing false defaults).

## 12. Person / roles

```text
Clerk subject → person_identity_link → dth_person (status)
dth_person → role_assignment / capability_assignment → resource scope
```

Service/worker/agent principals ≠ persons. No `is_admin` boolean architecture. Provider relink must not rewrite historical actor attribution (store person_id snapshots on events).

## 13. Database principal matrix (target)

| ROLE | CONNECT | TYPICAL ACCESS | BYPASSRLS | USED_BY | SECRET CLASS | BLAST |
|---|---|---|---|---|---|---|
| PUBLIC_INTAKE | YES | INSERT leads/career/intake audit/outbox; no broad SELECT | NO | Root public API | DB_PUBLIC_INTAKE | Intake only |
| OPS_API | YES | Ops CRUD per App AuthZ; controlled intake read | NO | packages/ops-api | DB_OPS | Ops+controlled intake |
| WORKER | YES | Claim jobs/outbox; domain writes via services | NO | packages/workers | DB_WORKER | Job scope |
| AUDIT_WRITER | YES | INSERT audit only | NO | shared audit path | DB_AUDIT | Audit append |
| MIGRATION_RUNNER | YES | DDL/DML migrations | MAYBE (exception, offline) | CI/Owner migrate | DB_MIGRATE | Full DB — offline only |
| READ_ONLY_SUPPORT | optional | SELECT limited | NO | break-glass support | DB_RO | Read blast |
| RECONCILIATION_JOB | optional | SELECT + limited update reconcile | NO | scheduled job | DB_RECON | Scoped |
| CC | NO DB | — | — | via Ops API | — | — |
| AGENT | NO DB | — | — | via tools/Ops API | — | — |
| service_role (current) | YES | unrestricted + BYPASSRLS | YES | root API today | LEGACY | **retire** |

## 14. service_role retirement

| | |
|---|---|
| CURRENT_PATH | `lib/leads/supabase.js` + `SUPABASE_SERVICE_ROLE_KEY` |
| CURRENT_CAPABILITY | Broad DB + BYPASSRLS |
| TARGET_ROLE | PUBLIC_INTAKE (narrow) |
| TARGET_MAXIMUM | Insert lead/career + intake audit + source outbox; optional INSERT…RETURNING of own row ids/refs only |
| MIGRATION_DEPENDENCY | Role/grants/RLS + API client switch |
| CUTOVER_PRECONDITION | Tests prove cannot SELECT arbitrary leads; staging parity |
| ROLLBACK | Keep legacy secret disabled-but-available in secret manager for emergency only; monitored |

## 15. Grants (conceptual)

Deny by default. PUBLIC_INTAKE: USAGE on intake namespace; INSERT on leads, career_applications, audit_events, source outbox; no DELETE; no Ops tables. OPS_API/WORKER: Ops objects as needed; intake SELECT limited. AUDIT_WRITER: INSERT only on audit tables. No runtime UPDATE/DELETE on audit.

## 16. RLS policy classes

| Class | Purpose |
|---|---|
| UNKNOWN_PRINCIPAL_DENY | default deny |
| PERSON_BOUND | rows visible to mapped person |
| ASSIGNMENT_BOUND | case rows if assigned |
| OWNER / CREATOR | limited self rows |
| DISABLED_PERSON_DENY | revoked persons |
| CROSS_CASE_DENY | no cross-tenant leak |
| TRUSTED_SERVICE_JOB | worker/ops service using non-bypass role + App AuthZ — **not** human RLS impersonation required for all jobs |

Human resource AuthZ ≠ forcing every worker through human RLS. Worker uses constrained service role + application policy + final control check.

## 17. App AuthZ vs DB

| Layer | Question |
|---|---|
| App AuthZ | May principal perform action X on resource Y? |
| GRANT | May this DB role touch this object/op? |
| RLS | Which rows for this non-bypass role? |

Defense in depth; none assumed perfect.

## 18. Public → Ops handoff (DTH-DT-A)

```text
BEGIN
  INSERT lead/career (accepted)
  INSERT intake audit (minimal)
  INSERT source outbox (event_id, idempotency_key, source_id, version)
COMMIT
→ worker claims outbox
→ idempotent Ops import / case-link processing
```

Fields: EVENT_ID, IDEMPOTENCY_KEY, SOURCE_ID, ATTEMPT, PROCESSED_STATE, ERROR_STATE. No XA. If Ops delayed, lead remains accepted.

## 19. Outbox / inbox

Lifecycle supports PENDING → CLAIMED (lease) → PROCESSED | FAILED → DEAD. Unique idempotency_key. Payload refs preferred; payload_redacted minimized. Inbox/import receipt: unique processed event id — duplicate delivery = no-op success.

## 20. Domain events vs commands

- **Domain event:** fact that happened (`lead.accepted`, `case.created`, …)
- **Command:** requested action with policy result (`communication.send`, …)

Do not overload one table as both. Correlation IDs link them.

## 21. Workflow / jobs / CONTROL_VERSION

Persist: workflow definition ref, instance, state, step, CONTROL_VERSION, pause/cancel/takeover flags, timestamps.

Jobs: id, workflow/execution ids, type, available_at, claimed_at, lease_until, claimed_by, attempt, state, idempotency, **control_version**, error ref.

**Stale rule:** takeover/pause/cancel/supersede increments CONTROL_VERSION; before external action `job.control_version == current`; else CANCEL_STALE_EXECUTION.

## 22. Kill switch persistence

Table/class `control_state`: scope (GLOBAL|DOMAIN|WORKFLOW|AGENT|CASE), state, reason, changed_by, changed_at, version, audit_ref.

**Precedence:** GLOBAL OFF overrides all lower ACTIVE automation. More specific ON cannot override GLOBAL OFF. Public intake remains independent where safe.

## 23. Session security persistence

Registry keyed by DTH person + provider session id reference (not raw tokens): admission, active session, revoked set, inactivity, max lifetime, generation. Multi-instance consistent via Postgres. Clerk remains provider authority.

## 24. Communication / suppression / approvals

Separate intent vs provider delivery vs thread. Provider ids at boundary. Suppression: DO_NOT_CONTACT, MARKETING_SUPPRESSED, BOUNCE, COMPLAINT, INVALID_ADDRESS — distinct from transactional legal bases (legal review). Approvals: request/decision with independent decider; agent cannot self-approve.

## 25. Audit / agent / DLQ

Append-only-for-runtime. Security-critical audit distinct (role/mapping/kill/break-glass/session revoke/privacy ops/agent external). Agent executions store operational refs not chain-of-thought. DLQ stores job/event refs + error class; payload copy only if strictly required.

## 26. Retention / deletion / DSAR

Classes: EPHEMERAL, SHORT_OPERATIONAL, ACTIVE_CASE, CUSTOMER_RECORD, SECURITY_AUDIT, LEGAL_HOLD, DELETION_PENDING. Durations: LEGAL_REVIEW_REQUIRED.

Deletion graph (conceptual):

```text
LEAD/CAREER → CASE → tasks/notes/assignments/comms/workflows/approvals
              ↘ audit (classify retain/anonymize)
              ↘ outbox/DLQ/agent traces (minimize then delete/anonymize)
              ↘ provider refs (reconcile externally)
```

DSAR: searchable via person/customer linkage indexes — not log archaeology.

Legal hold: optional capability preventing normal retention deletion for scoped resources.

## 27. Lineage

```text
FORM → LEAD/CAREER → CASE → WORKFLOW → COMMUNICATION_INTENT → PROVIDER_DELIVERY
```

Each hop retains source ids + runtime + whether AI-derived.

## 28. Backup / restore

One DB backup unit. Restore ≠ provider truth. Reconciliation via provider_reference + idempotency + outbox processed state. Risk: restored DB may attempt resend — prevented by durable provider delivery records + idempotency + final control check.

## 29. Integrity / concurrency / transactions

Uniqueness: idempotency keys, processed event ids, one active DTH session per person (enforced transactionally), approval decision once, outbox claim lease.

Canonical transactions (small):

1. Public intake acceptance (+ outbox)
2. Case create (+ events)
3. Domain state + outbox intent
4. Job claim
5. Human takeover / CONTROL_VERSION bump
6. Approval decision
7. Kill switch change
8. Session admission/replacement

## 30. Public failure semantics

Success response only after durable acceptance commit. Mail/AI/CC/worker failures do not roll back accepted lead.

## 31. Negative / privileged test plans (future M11+)

Deny: unknown/unmapped/disabled person; cross-case; agent direct DB; CC direct DB; public SELECT enumerate; public UPDATE/DELETE old rows; public access security/workflow; audit mutation; migration role at runtime; staging→prod credentials.

## 32. Failure domains

| Failure | Public | Ops | Loss | Recovery |
|---|---|---|---|---|
| DB down | Intake fail closed | Down | None if client retry | Restore + reconcile |
| Ops worker down | Intake OK | Lag | None (outbox durable) | Replay |
| Credential leak PUBLIC_INTAKE | Limited insert abuse | — | Spam risk | Rotate; abuse guards |
| service_role leak (legacy) | **Critical** | Full | High | Rotate immediately; accelerate retirement |
| RLS misconfig | — | Leak/deny | Varies | Policy fix + audit |

## 33. Migration strategy

| Stage | Impact | Structures | Dual-write? | Exit |
|---|---|---|---|---|
| CURRENT | Prod intake on service_role; Ops local | 001–002 live; 003–013 local | NO | Baseline |
| TRANSITION_A | Add roles/grants; keep schema | PUBLIC_INTAKE role; persist session/kill/workflow tables additive | Avoid | Public API can run on PUBLIC_INTAKE in staging |
| TRANSITION_B | Cutover public credential; AuthZ/RLS policies | Policies; retire service_role from normal path | Only if proven needed | Prod public without service_role |
| TARGET | Dual logical domains clear; optional physical schemas | Namespace clarity; full control plane durable | NO | Invariants green in staging+prod evidence |

## 34. Data contract versioning

Outbox/event payloads carry `schema_version`. Consumers accept N and N-1; unsupported → fail closed to retry/DLQ (no silent drop). No heavy schema registry required V1.

## 35. Data invariants

```text
EVERY_BUSINESS_DATUM_HAS_ONE_SOT
PUBLIC_INTAKE_CANNOT_ENUMERATE_CUSTOMER_DATA
PUBLIC_INTAKE_CANNOT_WRITE_OPS_STATE_ARBITRARILY
GENERAL_SERVICE_ROLE_NOT_NORMAL_RUNTIME_TARGET
DATABASE_GRANTS_AND_RLS_ARE_SEPARATE_CONTROLS
RLS_BYPASS_ROLE_REQUIRES_EXPLICIT_EXCEPTION
AGENT_HAS_NO_DIRECT_DB_ACCESS
CC_HAS_NO_DIRECT_DB_ACCESS
UNKNOWN_PRINCIPAL_DENY
PUBLIC_ACCEPTANCE_REQUIRES_DURABLE_WRITE
PUBLIC_TO_OPS_HANDOFF_IS_IDEMPOTENT
DUPLICATE_EVENT_CANNOT_CREATE_DUPLICATE_EFFECT
DOMAIN_STATE_AND_OUTBOX_INTENT_COMMIT_ATOMICALLY_WHERE_SAME_DB
NO_DISTRIBUTED_TRANSACTION_ASSUMPTION
PROVIDER_CALL_REQUIRES_COMMITTED_INTENT
WORKFLOW_STATE_IS_DURABLE
CONTROL_STATE_IS_DURABLE
HUMAN_TAKEOVER_INVALIDATES_STALE_EXECUTION
AUDIT_RUNTIME_CANNOT_UPDATE_OR_DELETE_PRIOR_AUDIT
AUDIT_MINIMIZES_PII
DLQ_MINIMIZES_PII
AGENT_TRACE_MINIMIZES_PII
AI_DERIVED_FACT_DOES_NOT_SILENTLY_OVERRIDE_VERIFIED_SOURCE_FACT
PRODUCTION_PII_NOT_REQUIRED_FOR_STAGING
RETENTION_IS_DATA_CLASS_SPECIFIC
DELETION_PROPAGATION_IS_TRACEABLE
MIGRATIONS_HAVE_ONE_CANONICAL_AUTHORITY
```

## 36. ADR index (M10)

ADR-017…ADR-032 (see `docs/architecture/adr/`).

## 37. M11 boundary

M10 = architecture only. M11+ = SQL, roles, grants, policies, tables, indexes, constraints, fixtures, tests. **No implementation in M10.**

## Appendix A — Source-of-Truth Registry (canonical entities)

| ENTITY | AUTHORITATIVE_OWNER | AUTHORITATIVE_STORE | CREATED_BY | MUTATED_BY | READ_BY | EXTERNAL_AUTHORITY? | RETENTION_CLASS | PII | AUDIT |
|---|---|---|---|---|---|---|---|---|---|
| LEAD | Public intake domain | leads (intake) | PUBLIC_INTAKE | Ops controlled + retention/admin | Ops API | NO | CUSTOMER_RECORD | PERSONAL | YES |
| CAREER_APPLICATION | Public intake | career_applications | PUBLIC_INTAKE | Ops + retention/admin | Ops API | NO | CUSTOMER_RECORD | PERSONAL | YES |
| CASE | Ops | cases | OPS_API/WORKER | OPS_API/WORKER | Ops API→CC | NO | ACTIVE_CASE | maybe | YES |
| PERSON | Security | dth_person (target) | OPS_API security | OPS_API | OPS_API | Clerk for auth subject | SECURITY/CUSTOMER ops | limited | YES |
| IDENTITY_MAPPING | Security | person_identity_link | OPS_API | OPS_API | OPS_API | Clerk subject | SECURITY_AUDIT | refs | YES security |
| ROLE/CAPABILITY/ASSIGNMENT | Security | assignment tables | OPS_API | OPS_API | OPS_API | NO | SECURITY_AUDIT | NO | YES |
| NOTE/TASK/STATUS_HISTORY | Ops | respective tables | OPS_API | OPS_API | OPS_API | NO | ACTIVE_CASE | maybe | YES |
| COMMUNICATION_INTENT/EVENT | Ops | communication_* | OPS_API/WORKER | OPS_API/WORKER | OPS_API | Provider for delivery | ACTIVE_CASE | minimize | YES |
| PROVIDER_DELIVERY | Boundary | provider refs + local state | WORKER | WORKER reconcile | OPS_API | YES provider | SHORT/ACTIVE | refs | YES |
| APPROVAL | Ops | approval_* | OPS_API | OPS_API (decider≠requester for critical) | OPS_API | NO | ACTIVE_CASE/SECURITY | NO | YES |
| DOMAIN_EVENT | Ops/intake | event store / outbox facts | services | append | services | NO | SHORT/AUDIT | minimize | correlate |
| COMMAND | Ops | command records | OPS_API/WORKER/Agent tools | state machine | OPS_API | NO | SHORT_OPERATIONAL | minimize | YES |
| OUTBOX | Intake/Ops | transactional_outbox | writers in txn | WORKER claim | WORKER | NO | SHORT_OPERATIONAL | minimize | correlate |
| INBOX_RECEIPT | Ops (if split) | import_receipt | relay consumer | consumer | OPS | NO | SHORT | refs | YES |
| WORKFLOW/JOB | Workflow | workflow_*/job_* | OPS/WORKER | WORKER/OPS | OPS | NO | ACTIVE_CASE | refs | YES |
| SESSION_SECURITY | Security | session_registry | OPS session svc | OPS | OPS | Clerk session | SECURITY_AUDIT | refs | YES |
| KILL/CONTROL_STATE | Security | control_state | OPS | OPS | OPS/WORKER | NO | SECURITY_AUDIT | NO | YES |
| AUDIT_EVENT | Audit domains | audit_events / ops_audit / security_audit | AUDIT_WRITER | NONE runtime | restricted | NO | SECURITY_AUDIT | minimize | self |
| AGENT_EXECUTION | Ops | agent_execution | Agent gateway | gateway | OPS | Model provider meta | SHORT_OPERATIONAL | minimize | YES |
| DEAD_LETTER | Workflow | dlq | WORKER | retry ops | OPS | NO | SHORT_OPERATIONAL | minimize | YES |
| RETENTION/DELETION/PRIVACY_OP | Governance | privacy_operations | OPS/admin | OPS | OPS | NO | SECURITY_AUDIT | refs | YES |
| LEGAL_HOLD | Governance | legal_hold | OPS authorized | OPS | OPS | NO | LEGAL_HOLD | refs | YES |

## M10R HARDENING (binding)

```text
M10R=PASS
DATA_TOPOLOGY_ID=DTH-DT-A (retained)
DATA_TOPOLOGY_DECISION_ROBUST=YES
PHYSICAL_SCHEMA_ISOLATION=REQUIRED
CANONICAL_ROLE_ASSUMPTION_PATTERN=DIRECT_POSTGRES_LOGIN_ROLE
PUBLIC_INTAKE_PRINCIPAL_FEASIBLE=YES
PUBLIC_INTAKE_ATOMIC_TRANSACTION_PATTERN=SERVER_DIRECT_POSTGRES_TRANSACTION
HUMAN_DB_CONTEXT_PATTERN=OPS_API_SET_REQUEST_SCOPED_DB_CONTEXT
INTERNAL_IDENTITY_ENTITY=OPERATOR_PERSON
EXTERNAL_DATA_SUBJECT_ENTITY=EXTERNAL_PARTY
SECURITY_CRITICAL_AUDIT_ATOMICITY_PATTERN=SAME_DATABASE_TRANSACTION_INSERT
KILL_SWITCH_LINEARIZATION_POINT=DISPATCH_AUTHORIZATION_RESERVATION
HUMAN_TAKEOVER_LINEARIZATION_POINT=CONTROL_VERSION_INCREMENT_IN_DB_TXN
POST_RESTORE_PRIVACY_RECONCILIATION=PRIVACY_OPS_LEDGER_PLUS_QUARANTINE_REPLAY
```

### Role assumption (per principal)

| RUNTIME | CONNECTION_PATH | AUTH_TO_DB | POSTGRES_ROLE | DATA_API? | BYPASSRLS | ROLE_ASSUMPTION |
|---|---|---|---|---|---|---|
| Public Intake API | Direct PG/pooler | LOGIN | dth_public_intake | NO target | NO | CONNECT as role |
| Ops API | Direct PG/pooler | LOGIN | dth_ops_api | NO | NO | CONNECT + set_config person |
| Worker | Direct PG/pooler | LOGIN | dth_worker | NO | NO | CONNECT as service |
| Migration | offline only | LOGIN privileged | dth_migration | NO | MAYBE offline | never in app runtime |
| CC/Agent | none | — | — | — | — | via Ops API only |

Rejected target: Data API + service_role for PUBLIC_INTAKE (BYPASSRLS).

### Default privileges
NEW_OBJECT_DOES_NOT_BECOME_RUNTIME_ACCESSIBLE_BY_ACCIDENT — default privileges must not grant new ops/security/workflow/audit objects to anon/authenticated/public_intake/Data API roles.

### Table ownership / FORCE RLS
RUNTIME_ROLE_MUST_NOT_OWN_PROTECTED_TABLE=YES
FORCE_RLS_POLICY_CLASS=PROTECTED_RUNTIME_TABLES

### Intake idempotency vs business matching
INTAKE_IDEMPOTENCY = server-validated key (not email/phone)
BUSINESS_MATCHING = separate EXACT/POSSIBLE/NO_MATCH/MANUAL_REVIEW on EXTERNAL_PARTY
Spam/validation failures are not durable LEADs.

### PUBLIC_ACCEPTANCE_COMMIT_POINT
After COMMIT of durable lead/career (+ outbox/audit in same txn).

### In-flight / provider
IN_FLIGHT | DISPATCH_AUTHORIZED | PROVIDER_CALL_STARTED | RESULT_UNKNOWN | DELIVERY_UNKNOWN
Adapter flags: SUPPORTS_PROVIDER_IDEMPOTENCY | SUPPORTS_STATUS_LOOKUP | SUPPORTS_WEBHOOK

### Provenance / AI
PROVENANCE_REQUIRED_FOR = customer critical; AI-derived; human corrections; decision-affecting provider states
AI precedence: CUSTOMER_PROVIDED > HUMAN_VERIFIED > PROVIDER_DERIVED > AI_PROPOSED

### Additional invariants
RUNTIME_ROLE_MUST_NOT_OWN_PROTECTED_TABLE
CAREER_DATA_NOT_ACCESSIBLE_TO_SALES_WORKFLOWS
LONG_LIVED_UNSTRUCTURED_PII_IS_NOT_CANONICAL_SOT
DISPATCHED_EXTERNAL_EFFECT_MATCHES_COMMITTED_INTENT
RESTORE_CANNOT_SILENTLY_REENABLE_MARKETING_CONTACT
CLIENT_SUPPLIED_PERSON_ID_NEVER_TRUSTED
OPERATOR_PERSON_NE_EXTERNAL_PARTY

See ADR-033, ADR-034.

## M10F CANONICAL DATA INVARIANT SET

```text
EVERY_BUSINESS_DATUM_HAS_ONE_SOT
OPERATOR_PERSON_IS_NOT_EXTERNAL_PARTY
CAREER_DATA_NOT_ACCESSIBLE_TO_SALES_WORKFLOWS
PUBLIC_INTAKE_CANNOT_ENUMERATE_CUSTOMER_DATA
PUBLIC_INTAKE_CANNOT_ARBITRARILY_UPDATE_OR_DELETE
PUBLIC_INTAKE_CANNOT_ACCESS_OPS_SECURITY_WORKFLOW_CONTROL_STATE
NORMAL_RUNTIME_ROLE_HAS_NO_BYPASSRLS
RUNTIME_ROLE_MUST_NOT_OWN_PROTECTED_TABLE
DDL_OWNER_IS_NOT_NORMAL_RUNTIME_ROLE
NEW_OBJECT_DOES_NOT_BECOME_RUNTIME_ACCESSIBLE_BY_ACCIDENT
GRANTS_AND_RLS_ARE_SEPARATE_CONTROLS
APPLICATION_AUTHZ_AND_RLS_ARE_SEPARATE_CONTROLS
CLIENT_SUPPLIED_PERSON_ID_IS_NOT_AUTHORITY
AGENT_SUPPLIED_ACTOR_ID_IS_NOT_AUTHORITY
AGENT_HAS_NO_DIRECT_DB_ACCESS
CC_HAS_NO_DIRECT_DB_ACCESS
PUBLIC_ACCEPTANCE_REQUIRES_DURABLE_COMMIT
TRANSPORT_IDEMPOTENCY_IS_NOT_BUSINESS_DEDUPLICATION
PUBLIC_TO_OPS_HANDOFF_IS_DURABLE
DUPLICATE_EVENT_CANNOT_CREATE_DUPLICATE_EFFECT
DOMAIN_STATE_AND_OUTBOX_COMMIT_ATOMICALLY_WHERE_REQUIRED
PROVIDER_CALL_REQUIRES_COMMITTED_INTENT
DISPATCHED_EXTERNAL_EFFECT_MATCHES_COMMITTED_INTENT
PROVIDER_TIMEOUT_DOES_NOT_TRIGGER_BLIND_DUPLICATE_RETRY
WORKFLOW_STATE_IS_DURABLE
CONTROL_STATE_IS_DURABLE
HUMAN_TAKEOVER_INVALIDATES_STALE_EXECUTION
NO_EXTERNAL_ACTION_WITHOUT_FRESH_CONTROL_CHECK
AUDIT_RUNTIME_CANNOT_UPDATE_OR_DELETE_PRIOR_AUDIT
SECURITY_CRITICAL_MUTATION_AND_AUDIT_ARE_ATOMIC_WHERE_REQUIRED
LONG_LIVED_UNSTRUCTURED_PII_IS_NOT_CANONICAL_SOT
AUDIT_MINIMIZES_PII
DLQ_MINIMIZES_PII
AGENT_TRACE_MINIMIZES_PII
AI_DERIVED_FACT_CANNOT_SILENTLY_OVERRIDE_VERIFIED_FACT
RESTORE_CANNOT_SILENTLY_REENABLE_DELETED_OR_SUPPRESSED_DATA
PRODUCTION_PII_NOT_REQUIRED_FOR_STAGING
MIGRATIONS_HAVE_ONE_CANONICAL_AUTHORITY
```

## M10F FREEZE

```text
DATA_TOPOLOGY_ID=DTH-DT-A
DATA_TOPOLOGY_NAME=Single Postgres Project — Physically Segmented Runtime Domains
PHYSICAL_SCHEMA_ISOLATION=REQUIRED
CANONICAL_ROLE_ASSUMPTION_PATTERN=DIRECT_POSTGRES_LOGIN_ROLE
PUBLIC_INTAKE_ATOMIC_TRANSACTION_PATTERN=SERVER_DIRECT_POSTGRES_TRANSACTION
HUMAN_DB_CONTEXT_PATTERN=OPS_API_SET_REQUEST_SCOPED_DB_CONTEXT
INTERNAL_IDENTITY_ENTITY=OPERATOR_PERSON
EXTERNAL_DATA_SUBJECT_ENTITY=EXTERNAL_PARTY
M10R=PASS
M10F=PASS (after commit)
IMPLEMENTATION_AUTHORIZED=NO
```

Domains: intake / ops / security / workflow / audit.  
ops|security|workflow|audit → DATA_API_EXPOSED=NO.

