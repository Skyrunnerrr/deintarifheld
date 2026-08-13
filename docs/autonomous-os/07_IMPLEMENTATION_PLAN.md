# 07 — Database Migration & Access-Control Implementation Plan

```text
TRANCHE=DTH-M11A
STATUS=FROZEN_M11ABF
BASELINE_HEAD=c3b26a4f6e3c53b76c5bb71099f6900c5824fae8
M10F=PASS
ARCHITECTURE_REOPEN=NO
SQL_AUTHORIZED=NO
IMPLEMENTATION_AUTHORIZED=NO
COMMIT_AUTHORIZED=NO
```

## 1. Mission

Move from current working public intake + local Ops foundation to M10F target (physically segmented domains, LOGIN principals, AuthZ+grants+RLS, durable controls) via **ordered, reversible, testable** tranches — without big-bang, without guessing production migration state.

## 2. Current implementation reality (repo wins)

| COMPONENT | PATH | CREDENTIAL | DB_PATH | SCHEMA | PROD? | TARGET |
|---|---|---|---|---|---|---|
| Public intake | `lib/leads/supabase.js` + leads/careers/admin/retention APIs | `SUPABASE_SERVICE_ROLE_KEY` | Data API | `public` | YES (E5 docs) | `dth_public_intake` direct PG txn |
| Ops BFF | `packages/ops-api` | `DTH_LOCAL_DATABASE_URL` | `pg.Pool` (remote refuse) | `public` | NO | `dth_ops_api` + set_config |
| Outbox claim | `packages/db/src/outbox-claim.js` | local URL | `pg.Pool` | `public` | NO | `dth_worker` |
| Session/kill/mapping | shared/ops-api memory | none | in-memory | n/a | NO | Postgres security domain |
| Drafts | `packages/db/migrations/drafts` | n/a | DO_NOT_APPLY | design | NO | archive/reference only |

## 3. Migration inventory

| ID | STATUS | PROD | TARGET |
|---|---|---|---|
| 001–002 | Public spine | Claimed E5; **not live-probed this program** | RETAIN immutable; never rewrite |
| 003–013 | LOCAL_APPLY_ONLY | **NOT proven** | Never dual-apply drafts; apply only after Owner auth + reconciliation |
| packages/db drafts | DO_NOT_APPLY | NO | Remain design reference; later archive; re-express only via new canonical migrations if needed |

**Rule:** Never rewrite applied production migrations. Correct via future additive migrations only.

## 4. Production migration certainty

```text
PRODUCTION_MIGRATION_STATE=PROVEN (M11B)
```

- 001–002: documented E5 presence; 002 file still says remote apply forbidden historically → **must reconcile** before any prod DDL.
- 003–013: explicitly unproven on production.
- No CI remote migrate; no agent SQL history probe in M11A.

**Consequence:** First executable tranche after M11A Owner acceptance must be **READ-ONLY** production migration-state reconciliation — **not SQL**.

## 5. Canonical migration authority

```text
CANONICAL_APPLY_ROOT=supabase/migrations/
DRAFTS=DO_NOT_APPLY (never dual-apply)
```

Future: archive drafts under `packages/db/migrations/archive/` (Owner-approved later); ledger = Supabase migration history + governance evidence. No second apply root.

## 6. Dependency graph (verified)

```text
M11B Production migration-state readback (READ-ONLY)
  → M11C Staging environment foundation (Owner/provider)
  → M11D DDL owner + migration runner custody (no app runtime secret)
  → M11E Private schemas + default privilege hardening (ops/security/workflow/audit)
  → M11F Runtime LOGIN roles (staging) + CONNECT/USAGE
  → M11G Object grants (least privilege; runtime NOT owner)
  → M11H OPERATOR_PERSON + identity mapping
  → M11I Role/capability/assignment (minimal catalog)
  → M11J Strong application AuthZ
  → M11K Request-scoped DB context + pooler proof
  → M11L RLS wave 1 (security)
  → M11M RLS wave 2 (ops) + positive/negative harness
  → M11N Durable session registry
  → M11O Durable kill/control + CONTROL_VERSION
  → M11P Staging E2E (AuthZ→RLS→Ops)
  → M11Q PUBLIC_INTAKE LOGIN + atomic intake txn (staging)
  → M11R Career purpose-boundary cutover tests
  → M11S service_role retirement cutover (staging→prod gates)
  → M11T Source outbox + Public→Ops handoff (coupled with Q where needed)
  → M11U EXTERNAL_PARTY + DSR linkage (+ backfill)
  → M11V Workflow persistence (jobs/leases)
```

AuthZ and operator mapping precede human RLS. Staging precedes any production privilege cutover. Outbox may couple with atomic intake (Q/T). EXTERNAL_PARTY does not block AuthZ. Session/kill after RLS foundation preferred.

## 7. Critical paths

```text
CRITICAL_PATH_TO_STAGING=
M11B → M11C → M11D → M11E → M11F → M11G → M11H → M11I → M11J → M11K → M11L → M11M → M11N → M11O → M11P

CRITICAL_PATH_TO_PUBLIC_INTAKE_CUTOVER=
(above through M11P) → M11Q → M11R → M11T(staging) → M11S → prod smoke + observation
```

## 8. Physical schema strategy

**Selected: Hybrid evolutionary (C+A)**

1. **Do not move** live `public.leads` / `career_applications` / `audit_events` in early tranches (API stability, no downtime).
2. Create empty private schemas `ops`, `security`, `workflow`, `audit` first; place **new** internal objects there.
3. Optionally introduce `intake` schema later; keep public intake tables in `public` during compatibility phase OR create intake schema + views for transition (decide in M11E with lock/API impact assessment).
4. Relocate Ops tables (cases…) only after staging proof — prefer create-in-target-schema + migrate if never production-applied; if production-applied, use careful `SET SCHEMA` only with maintenance plan.

**Rejected for V1:** Big-bang move of all tables for aesthetics; dual-project split.

## 9. DDL owner / migration runner

```text
DDL_OWNER / MIGRATION_RUNNER = same privileged class for V1 simplicity
  (controlled offline/CI release only)
≠ any runtime LOGIN role
```

Custody: separate secret; never loaded by Public/CC/Worker/Agent; audited; rotatable; revoked after release window.

## 10. Default privileges & Data API

Establish default-deny for new objects in private schemas **in M11E before proliferating tables**.

Data API: ensure ops/security/workflow/audit **not** in exposed schemas list — **OWNER_ACTION** in Supabase Dashboard (separate from SQL). Verify after each schema tranche.

## 11. LOGIN roles & connection/pooler

Create staging roles: `dth_public_intake`, `dth_ops_api`, `dth_worker` — NO BYPASSRLS, NOT owners.

**Pooler risk:** transaction pooling + `set_config(..., true)` must be proven transaction-local with **no cross-request identity leak**. Prefer session mode or direct connection until staging proof (M11K). Flag: `REQUIRES_STAGING_PROOF`.

OPS_API V1: **one backend LOGIN role** + request-scoped person context (not one DB login per human).

WORKER: single role with job-scoped grants; no human impersonation; expand classes later only if evidence requires.

## 12. PUBLIC_INTAKE implementation approach

Target pattern (M10-compatible):

```text
SERVER_DIRECT_POSTGRES_TRANSACTION
+ object grants (INSERT intake objects)
+ minimal RLS if needed
```

Not Data API + service_role. If prototype needed: optional **M11Q-POC** local/staging before production cutover — still no production mutation until gates pass.

Feature switch: **single active write path** + fast rollback config (prefer no dual-write).

## 13. service_role retirement gates

```text
PUBLIC_INTAKE_STAGING_PASS
ATOMIC_TXN_PASS
NEGATIVE_ACCESS_PASS
POSITIVE_INSERT_PASS
CAREER_PASS
PROD_SMOKE_PASS
OBSERVATION_WINDOW_PASS
ROLLBACK_READY
→ NORMAL_PUBLIC_SERVICE_ROLE_USAGE=RETIRED
```

Credential may remain in vault for emergency rollback; normal runtime use stops. Rollback ≠ permanent unrestricted restore.

## 14. Atomic intake & outbox

Same PG transaction: Lead/Career + source outbox + minimal audit. Any failure → full rollback; no partial acceptance; HTTP success only after commit.

Outbox durable write **before** worker consumption. Prefer implement outbox write with Q; worker consume after T staging.

Career: separate test path; sales workflows must deny career access.

## 15. AuthZ / RLS / FORCE RLS

AuthZ library before production Ops. RLS waves: security → ops → communications → workflow/control. Positive + negative harness required.

FORCE RLS: candidate on protected tables after owner≠runtime proven; enable only with positive access proof — not blind global FORCE.

## 16. Audit atomicity implementation

Domain transaction holds **INSERT-only** on required audit tables (or INVOKER function with fixed search_path). Mandatory security audit **same txn**. Async AUDIT_WRITER not for critical path. UPDATE/DELETE audit denied for runtimes.

## 17. Session / kill / EXTERNAL_PARTY / workflow

Separate tranches after AuthZ/RLS foundation (N/O). EXTERNAL_PARTY (U) after staging Ops path; does not block AuthZ. Workflow (V) after outbox handoff stable.

## 18. Staging & data policy

Staging **required** before role/RLS/PUBLIC_INTAKE production cutover. Synthetic data only — no production PII.

## 19. Expand–Migrate–Contract & reversibility

Prefer additive EXPAND → MIGRATE → VERIFY → CONTRACT. Classify each migration: FULLY_REVERSIBLE preferred early; irreversible only with backup + Owner.

Backfills: batched, idempotent, dry-run, counts/checksums; no silent overwrite; no PII in evidence.

FKs: preflight; NOT VALID → validate later if lock risk.

## 20. Compatibility matrix

Prefer OLD_APP + NEW_DB safe (additive). If NEW_APP requires NEW_DB: deploy DB first, then app. Document per tranche.

## 21. Owner / provider actions

| ACTION | CLASS |
|---|---|
| Production schema/migration history readback | OWNER + READ_ONLY_VERIFICATION |
| Staging Supabase project / env | OWNER_ACTION |
| Exposed schemas Dashboard config | OWNER_ACTION |
| Production secret provisioning | OWNER_ACTION |
| Connection allowlists | OWNER_ACTION |
| Break-glass DB access (optional V1) | OWNER-controlled; not normal runtime |

## 22. Autonomy blockers (record)

BLOCKING_BEFORE_AUTONOMY: durable AuthZ, workflow, kill, CONTROL_VERSION, audit, outbox, provider reconcile, suppression, approval.

## 23. Deliberate deferrals

AI agents, social/content systems, BPMN, specialized queue, multi-region, separate DB projects, data warehouse, oversized CRM, dozens of DB roles.

## 24. Ordered implementation tranches

| ORDER | TRANCHE_ID | TITLE | OBJECTIVE | DEPENDS | ENV | MUTATION | RISK | ROLLBACK | MIN_EVIDENCE | BLOCKS |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | M11B | Production Migration State Reconciliation | Prove 001–013 apply state via read-only probe | M11A Owner accept | Prod read-only | NONE | Low | N/A | E3 | All prod DDL |
| 2 | M11C | Staging Environment Foundation | Staging project/secrets/synthetic seed policy | M11B | Staging create | Config/Owner | Med | Destroy staging | E4 setup | Cutover |
| 3 | M11D | DDL Owner + Migration Runner Custody | Privileged migrate identity offline/CI only | M11C | Staging | Roles/custody | Med | Revoke | E2/E4 | Schema DDL |
| 4 | M11E | Private Schema + Default Privilege Foundation | Create ops/security/workflow/audit; default-deny | M11D | Staging | DDL | Med | Drop empty schemas | E2/E4 | New objects |
| 5 | M11F | Runtime LOGIN Roles | Create LOGIN roles; no BYPASSRLS; not owners | M11E | Staging | Roles | Med | DROP ROLE | E2/E4 | Grants |
| 6 | M11G | Schema/Object Grants | Least-privilege grants | M11F | Staging | Grants | Med | REVOKE | E2/E4 | App DB use |
| 7 | M11H | OPERATOR_PERSON + Mapping | Persist Clerk→operator | M11G | Staging | DDL+data | Med | Forward-fix | E2/E4 | Human RLS |
| 8 | M11I | Capability Assignments Minimal | Non-is_admin AuthZ data | M11H | Staging | DDL+data | Med | Forward-fix | E2/E4 | AuthZ |
| 9 | M11J | Strong Application AuthZ | Server decision API fail-closed | M11I | Staging code | Code | Med | Feature flag | E2/E4 | Context/RLS |
| 10 | M11K | Request-Scoped DB Context + Pooler Proof | set_config txn-local; leak tests | M11J | Staging | Code+config | High | Flag off | E4 | RLS human |
| 11 | M11L | RLS Wave 1 Security | Policies on security tables | M11K | Staging | Policies | High | Disable policy / restore | E4 | Ops RLS |
| 12 | M11M | RLS Wave 2 Ops + Harness | Cases/tasks; ± tests | M11L | Staging | Policies | High | Same | E4 | Session/kill |
| 13 | M11N | Durable Session Registry | Replace in-memory session | M11M | Staging | DDL+code | Med | Flag memory | E4 | Prod Ops |
| 14 | M11O | Durable Kill/Control + CONTROL_VERSION | Replace in-memory kill | M11N | Staging | DDL+code | Med | Flag memory | E4 | Autonomy prep |
| 15 | M11P | Staging E2E AuthZ→RLS→Ops | End-to-end proof | M11O | Staging | none | Low | N/A | E4 | Public cutover |
| 16 | M11Q | PUBLIC_INTAKE LOGIN + Atomic Txn | Direct PG intake path | M11P | Staging | Code+grants | High | Switch old path | E4 | service_role retire |
| 17 | M11R | Career Purpose Boundary Cutover | Career tests ≠ sales access | M11Q | Staging | Tests/grants | Med | Flag | E4 | Prod career |
| 18 | M11T | Source Outbox + Handoff (staging) | Outbox with intake txn; worker later | M11Q | Staging | DDL+code | High | Flag | E4 | Cutover |
| 19 | M11S | service_role Retirement Cutover | Stop normal service_role use | M11Q/R/T+gates | Staging→Prod | Config/secrets | Critical | Controlled rollback | E5+E6 | Done |
| 20 | M11U | EXTERNAL_PARTY + DSR Linkage | Party + backfill plan | M11P+ | Staging→Prod | DDL+backfill | Med | Forward-fix | E4/E5 | DSR maturity |
| 21 | M11V | Workflow Persistence | Jobs/leases/DLQ | M11T+ | Staging | DDL+code | Med | Flag | E4 | Autonomy |

Combine only if rollback/safety allows; do not merge B with mutation tranches.

## 25. First executable tranche

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M11C_STAGING_ENVIRONMENT_FOUNDATION
WHY_THIS_IS_FIRST=M11ABF frozen; Staging foundation required before M11D security DDL.
```

## 26. Stop conditions (all future SQL tranches)

Unexpected DB state; unknown migration history; wrong env connection; secret exposure; unexpected owner/BYPASSRLS/default grants; incomplete RLS; baseline test fail; checksum mismatch; unapproved destructive SQL; impossible rollback; production PII in test; scope expansion.

## 27. Plan red-team (summary)

| Risk | Mitigation in sequence |
|---|---|
| RLS lockout | Positive tests before prod; staged waves; rollback |
| Migration owner as runtime | Custody separation M11D |
| Schema Data API exposure | Owner Dashboard + verify M11E |
| Secret leak to wrong runtime | Secret distribution matrix |
| Early service_role removal | M11S gates |
| Intake break during Ops migrate | Hybrid schema; no early public move |
| Pooler identity leak | M11K proof required |
| Dual-apply drafts | Authority freeze + M11B |
| Rollback to insecure broad access | Break-glass governed; not default |
| App/schema skew | Compatibility matrix |

## 28. Break-glass

Optional V1: Owner-controlled emergency DB role, time-bounded, audited — **not** same as migration runner or normal runtime. Not required to invent if Owner prefers restore-from-safety-branch + controlled migrate.

---

Detail templates for each tranche live in `docs/autonomous-os/evidence-reports/DTH-M11A.md`.

## M11B STATUS UPDATE

```text
M11B=PASS
PRODUCTION_MIGRATION_STATE=PROVEN
PROD_DB_BASELINE_ID=DTH-PROD-DB-20260813-de5e6bd1ecf4
REMOTE_DRIFT_CLASS=NO_DRIFT_OBSERVED
M11B-ACL-01 → concrete input for M11E (default privileges)
M11B-ACL-02 → concrete input for M11G (object grants)
PLAN_ORDER_CHANGE=NO (M11E/M11G already sequenced; priority reinforced)
M11C_ENTRY=ALLOWED_AFTER_OWNER_FREEZE_OF_M11A_M11B
```

## ACL FINDINGS → PLAN LINKAGE (M11ABF freeze)

```text
M11B-ACL-01 (DEFAULT PRIVILEGES) → M11E Private Schema + Default Privileges
M11B-ACL-02 (OBJECT GRANTS) → M11G Schema/Object Grants
```

M11E acceptance must prove: future/new objects do not become runtime-accessible by accident (deny-by-default defaults).

M11G acceptance must prove: only intended runtime privileges remain on intended objects.

## M11C ENTRY CONTRACT (frozen)

```text
M11C_ENVIRONMENT=STAGING
PRODUCTION_DB_MUTATION_ALLOWED=NO
PRODUCTION_SCHEMA_MUTATION_ALLOWED=NO
PRODUCTION_ROLE_MUTATION_ALLOWED=NO
PRODUCTION_CONFIG_MUTATION_ALLOWED=NO
PRODUCTION_PII_ALLOWED=NO
STAGING_DATA=synthetic only
```

## M11C STATUS UPDATE

```text
M11C=PASS
STAGING_TOPOLOGY=DTH-STG-A
STAGING_PROJECT=deintarifheld-staging / uunpbmfvbfkideylhtbl
M001_STAGING=PASS
M002_STAGING=PASS
M003_013_STAGING=NO
STRUCTURE_PARITY=YES
NEXT=DTH-M11CF then M11D
M11D=NOT_STARTED
```

## M11CF FREEZE

```text
M11C=PASS
M11CF=PASS (freeze)
STAGING_BASELINE_FROZEN=YES
NEXT_TRANCHE=M11D DDL Owner + Migration Runner Custody
M11D_TARGET=STAGING_ONLY
M11D_FIRST_DUTY=inventory Supabase-managed owner/migration roles; prove what may change before inventing DDL_OWNER
SEQUENCE_UNCHANGED=M11D→E→F→G→H→I→J→K→L→M→N→O→P→Q→R→T→S→U→V
```

## M11D PASS — MODEL A

```text
M11D=PASS
M11D_MODEL=MODEL_A POSTGRES_AS_DDL_OWNER
NEW_ROLES_CREATED=NO
M11E_DEFAULT_PRIVILEGE_OWNER_PRINCIPAL=postgres
NEXT=M11E Private Schema + Default Privileges (Staging-first; before/after tests required)
M11E=NOT_STARTED
```

## M11E-P0 PASS

```text
M11E=IN_PROGRESS
M11E-P0=PASS
ACTIVE_MIGRATIONS=001,002
LEGACY_003_013=archive/supabase-migrations/pre-m11-security/
NEXT=M11E-R1 Private Schema + Default Privileges
```

## M11E-R1A PASS (pre-apply freeze)

```text
M11E=IN_PROGRESS
M11E-R1A=PASS
MIGRATION=20260813104040_m11e_private_schema_default_privileges.sql
SHA256=04c8dd4b03f840ba641f934d5e1d8bd1ebefb95854f39b1b4c21dd02f44aa4db
STAGING_APPLY=NO
NEXT=M11E-R1B Staging apply of exact authorized hash only
THEN=M11E-R2 readback + negative tests → M11E-F freeze
```

## M11E-R1B PASS (Staging apply)

```text
M11E=IN_PROGRESS
M11E-R1B=PASS
STAGING_REMOTE_HISTORY=001,002,20260813104040
ACL_01_CONFIGURATION_APPLIED=YES
ACL_01_RESOLVED=NO
NEXT=M11E-R2 Readback + disposable-object negative security tests
THEN=M11E-F freeze
```

## M11E-R2 PASS (behavioral proof + gap classification)

```text
M11E=IN_PROGRESS
M11E-R2=PASS
ACL_01_CORE_API_ROLE_DEFAULTS_RESOLVED=YES
PUBLIC_ROUTINE_FAIL_CLOSED_GAP=CONFIRMED
ACL_01_FULL_FAIL_CLOSED=NO
NEXT=M11E-R3 Public routine default hardening decision
THEN=M11E-F freeze only after gap closed or Owner accepts residual risk
```

## M11E-R3A PASS (decision + transactional proof)

```text
M11E=IN_PROGRESS
M11E-R3A=PASS
DECISION=OPTION_A_ADOPT_GLOBAL_POSTGRES_PUBLIC_EXECUTE_REVOKE
PERSISTENT_MUTATION=NO
NEXT=M11E-R3B Routine default security migration pre-apply freeze
THEN=R3C Staging apply → re-proof → M11E-F
```

## M11E-R3B PASS (pre-apply freeze)

```text
M11E=IN_PROGRESS
M11E-R3B=PASS
MIGRATION=20260813171649_m11e_global_routine_default_hardening.sql
SHA256=871c20524ee8c4c98a36e795051fa545f205676c988082854ec8034969b6dca5
STAGING_APPLY=NO
NEXT=M11E-R3C Staging apply of exact authorized hash + behavioral re-proof
```

## M11E-R3C PASS (Staging apply + behavioral re-proof)

```text
M11E=IN_PROGRESS
M11E-R3C=PASS
STAGING_REMOTE_HISTORY=001,002,20260813104040,20260813171649
ACL_01_FULL_FAIL_CLOSED=YES
DTH-RISK-FUNCTION-PUBLIC-EXECUTE=CLOSED_FOR_FUTURE_POSTGRES_CREATED_ROUTINES
ACL_02_RESOLVED=NO
PRIVATE_SCHEMA_DATA_API_EXPOSURE=UNPROVEN
NEXT=M11E-R4 Hosted Data API exposure readback (read-only preferred)
THEN=M11E-F freeze after R4; do NOT start M11F yet
```

## M11E-R4 PASS (hosted Data API exposure readback)

```text
M11E=IN_PROGRESS_PENDING_FREEZE
M11E-R4=PASS
PRIVATE_SCHEMA_DATA_API_EXPOSURE=PROVEN_NOT_EXPOSED
PROVIDER_EXPOSURE_BOUNDARY=PASS
DATABASE_SCHEMA_PRIVILEGE_BOUNDARY=PASS
HOSTED_EXPOSED_SCHEMAS=graphql_public,public
AUTOMATIC_EXPOSURE_SETTING=OFF
ACL_02_RESOLVED=NO
NEXT=M11E-F Security baseline freeze
DO_NOT_START_M11F=YES
```
