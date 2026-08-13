# Decision Log

## D-001 — Freeze Blueprint v2.0

DATE=2026-08-12  
STATUS=ACCEPTED  
DECISION=Adopt Autonomous OS Master Blueprint v2.0 as frozen change-controlled plan.  
CONSEQUENCE=No spontaneous architecture drift; changes require ADR + risk review.

## D-002 — Agents are not the foundation

DATE=2026-08-12  
STATUS=ACCEPTED  
DECISION=Deterministic workflow + policy engines are authoritative; AI workers are bounded and replaceable.  
CONSEQUENCE=No free master agent; no agent-created agents; no direct AI→external API path.

## D-003 — Secure 14 local commits before further work

DATE=2026-08-12  
STATUS=EXECUTED  
DECISION=Execute DTH-M0…M5 before feature/agent work.  
EVIDENCE=safety/dth-p3-p4-freeze-955e849 @ 955e849; local bundle PASS.

## D-004 — Canonical architecture ADR required before automation

DATE=2026-08-12  
STATUS=PENDING_M9_M10  
DECISION=Resolve root vs packages, public vs ops storage, and Lead→Ops flow via ADR before workflow/agent runtime.  
CONSEQUENCE=No durable automation runtime until ARCHITECTURE_CANONICAL=PASS.

## D-005 — Evidence levels E0–E6

DATE=2026-08-12  
STATUS=ACCEPTED  
DECISION=Replace vague PROVEN/COMPLETE claims with E0–E6 evidence levels.  
CONSEQUENCE=Production readiness cannot be asserted from unit tests alone.

## D-006 — Compliance is a control matrix, not a boolean

DATE=2026-08-12  
STATUS=ACCEPTED  
DECISION=Never emit `GDPR_COMPLIANT=true`. Use control-by-control status with evidence and legal-review flags.


## D-007 — M6 gate replacement: cleanup-window mutation safety

DATE=2026-08-12  
STATUS=ACCEPTED_DOCUMENTATION_ONLY  
DECISION=Replace M6 gate OTHER_USERS_UNCHANGED with NO_UNINTENDED_USER_MUTATION_IN_CLEANUP_WINDOW.  
REASON=Absolute historical unchanged claim is not strictly provable without a persistent pre-delete baseline.  
CONSEQUENCE=M6 cleanup safety is audited via Clerk Application Logs in the known cleanup window (event/actor/subject/time filters), not via invented baseline comparison.  
RETROACTIVE_EVIDENCE=FORBIDDEN

## D-008 — Dual-tier evidence architecture

DATE=2026-08-12  
STATUS=ACCEPTED_DOCUMENTATION_ONLY  
DECISION=Canonical evidence is two-tier: (A) redacted commitable reports under docs/autonomous-os/evidence-reports/; (B) raw/provider artifacts under ~/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/.  
FORBIDDEN=/tmp as canonical evidence; secrets/tokens/full PII in git.

## D-009 — Parallel tracks: M6 historical vs Track B engineering

DATE=2026-08-12  
STATUS=ACCEPTED  
DECISION=Split work into TRACK A (DTH-M6 historical Clerk evidence closure) and TRACK B (M7+ engineering/architecture documentation).  
CONSEQUENCE=M6 remains OPEN and AWAITING_OWNER_READBACK, but is **not** a global freeze on read-only documentation, local evidence reconstruction, or architecture ADRs.  
STILL_BLOCKED_BY_M6_UNTIL_CLOSED_OR_OWNER_RISK_ACCEPTANCE=Production identity closure; live Clerk mutations; production AuthZ/RLS claims that depend on formal H0b3d cleanup proof.  
FORBIDDEN=Inventing M6 PASS; Cursor self-granting ACCEPTED_HISTORICAL_EVIDENCE_GAP.

## D-010 — DTH-M7 evidence reconstruction complete (local)

DATE=2026-08-12  
STATUS=ACCEPTED_PENDING_OWNER_REVIEW  
DECISION=M7 PASS means inventoriable claims are inventoried, reproducible local evidence re-run and persisted, gaps explicit — not that all historical live proofs are restored.  
EVIDENCE=docs/autonomous-os/evidence-reports/DTH-M7.md + Application Support DTH-M7 raw hashes.

## D-011 — DTH-M8 Phase-4 reconciliation; architecture exit allowed

DATE=2026-08-13  
STATUS=ACCEPTED_PENDING_OWNER_REVIEW  
DECISION=Phase-4 local security foundation is complete enough to authorize **M9 architecture documentation**, not implementation, staging, or production.  
CANONICAL=
PHASE4_LOCAL_FOUNDATION=PASS  
PHASE4_REMOTE_DEV_EVIDENCE=PARTIAL  
PHASE4_STAGING_READY=NO  
PHASE4_PRODUCTION_READY=NO  
PHASE4_EXIT_TO_ARCHITECTURE_ALLOWED=YES  
PHASE4_EXIT_TO_IMPLEMENTATION_ALLOWED=NO  
PHASE4_EXIT_TO_STAGING_ALLOWED=NO  
PHASE4_EXIT_TO_PRODUCTION_ALLOWED=NO  
CONSEQUENCE=Do not extend in-memory session/kill/AuthZ as the production design; resolve root vs packages and SoT in M9/M10 ADRs. M6 remains OPEN (Track A).

## D-012 — M8C corrections before architecture

DATE=2026-08-13  
STATUS=ACCEPTED  
DECISION=
1) H0b2a JWKS does not require Clerk Secret; live gap is authenticated Dev session/provider readback.  
2) RLS does not protect against service-role bypass — M9 must define runtime credential boundaries.  
3) In-memory session/kill = local/dev only.  
4) Dual runtime (root public vs packages Ops) and dual migration ownership are ADR inputs for M9/M10.  
FORBIDDEN=Starting M9 before M8C remote safety freeze verifies.

## D-013 — Canonical runtime = Evolutionary Dual-Plane (DTH-ERA-A)

DATE=2026-08-13  
STATUS=PROPOSED_PENDING_OWNER_REVIEW  
DECISION=Select DTH-ERA-A: root Next remains canonical public runtime; packages ops-api/cc/workers/shared/db become canonical Ops runtime; deprecate packages/web and packages/api skeletons; public→Ops via durable intake + async handoff; Postgres-backed session/kill; Postgres+worker workflow first; agents only via Ops tools.  
REJECTED=Full consolidation into packages/web|api now; permanent public+Ops monolith.  
EVIDENCE=docs/autonomous-os/evidence-reports/DTH-M9.md + docs/architecture/adr/ADR-001…016  
IMPLEMENTATION_AUTHORIZED=NO

## D-014 — M9R hardening accepted; freeze pending Owner

DATE=2026-08-13  
STATUS=PROPOSED_PENDING_OWNER_REVIEW  
DECISION=M9R=PASS. Keep DTH-ERA-A. Apply hardenings: Clerk vs DTH session authority; Worker→Domain Service (no mandatory HTTP hairpin); M10-compatible handoff; outbox-before-provider; last-mile control check; execution generation for takeover; kill fail-closed for risky automation; audit=append-only-for-runtime; Postgres-first with upgrade triggers; public intake capability ceiling.  
NEXT=Owner review → M9F freeze (commit + safety branch) → M10.  
M10_AUTHORIZED=NO

---

## DTH-M9F — Canonical Runtime Architecture Freeze

DATE=2026-08-13  
DECISION=Freeze DTH-ERA-A Evolutionary Dual-Plane as governed contract. ADRs ACCEPTED / ACCEPTED_WITH_M10_DEPENDENCY as listed in DTH-M9F. No new architecture. No implementation. M10 owns data/SoT/grants/RLS/lineage.  
STATUS=ACCEPTED  
M6=OPEN (unchanged)

---

## DTH-M10 — Canonical Data & Source-of-Truth Architecture

DATE=2026-08-13  
DECISION=Select DTH-DT-A Single Postgres Project Dual Logical Domains. SoT registry, PUBLIC_INTAKE role replacing broad service_role target, grants+RLS+App AuthZ layers, CONTROL_VERSION, durable session/kill/workflow, supabase/migrations as sole apply root.  
STATUS=PROPOSED_PENDING_M10R_AND_OWNER  
IMPLEMENTATION=NO  
M6=OPEN (unchanged)

---

## DTH-M10R — Principal Data Security Review

DATE=2026-08-13  
DECISION=M10R=PASS. Retain DTH-DT-A. Harden: direct PG LOGIN roles; physical private schemas; atomic server txn; human set_config context; OPERATOR_PERSON≠EXTERNAL_PARTY; same-txn security audit; dispatch-authorization kill linearization; privacy_ops restore reconcile.  
STATUS=ACCEPTED_PENDING_M10F  
IMPLEMENTATION=NO

---

## DTH-M10F — Canonical Data Architecture Freeze

DATE=2026-08-13  
DECISION=Freeze DTH-DT-A Physically Segmented Runtime Domains as governed data contract (M10+M10R). No SQL. Implementation requires M11A planning first.  
STATUS=ACCEPTED  
M6=OPEN (unchanged)

---

## DTH-M11A — Database Migration & Access-Control Implementation Plan

DATE=2026-08-13  
DECISION=Adopt ordered expand-migrate-contract implementation plan in 07_IMPLEMENTATION_PLAN.md. PRODUCTION_MIGRATION_STATE=PARTIAL → next tranche M11B read-only reconciliation. No SQL in M11A.  
STATUS=PROPOSED_PENDING_OWNER  
SQL=NO

---

## DTH-M11B — Production Migration State Reconciliation (in progress)

DATE=2026-08-13  
DECISION=Project identity verified from existing link metadata; remote migration/schema readback unavailable without CLI/Owner-assisted metadata. M11B=OPEN. No mutation.  
STATUS=OPEN  
SQL=NO

---

## DTH-M11B — Production Migration State Reconciliation (FINAL)

DATE=2026-08-13  
DECISION=M11B=PASS. PRODUCTION_MIGRATION_STATE=PROVEN. Baseline DTH-PROD-DB-20260813-de5e6bd1ecf4. 001/002 match Git; 003–013 absent; ACL-01/02 legacy hardening inputs for M11E/G. No mutation.  
STATUS=ACCEPTED_PENDING_OWNER_FREEZE_WITH_M11A  
M11C=NOT_STARTED

---

## DTH-M11ABF — Implementation Plan + Production Baseline Freeze

DATE=2026-08-13  
DECISION=Freeze M11A implementation plan + M11B proven Production baseline DTH-PROD-DB-20260813-de5e6bd1ecf4. 001/002 spine; 003–013 absent; no unexplained drift; ACL-01→M11E; ACL-02→M11G. Staging next; Production security mutation still forbidden.  
STATUS=ACCEPTED  
M6=OPEN (unchanged)  
M11C=NOT_STARTED

---

## DTH-M11C — Staging Topology Decision (pre-mutation)

DATE=2026-08-13  
DECISION=Adopt DTH-STG-A Dedicated Supabase Staging Project (`deintarifheld-staging`). Reject Persistent Branch for foundation due to isolation, credential clarity, promotion risk, and lack of Production GitHub connection benefit.  
STATUS=ACCEPTED (decision only; Staging project not yet created)  
M11C_PROVIDER_STATE=OPEN  
PRODUCTION_MUTATED=NO

---

## DTH-M11C — Staging Foundation PASS

DATE=2026-08-13  
DECISION=Dedicated Staging project deintarifheld-staging (uunpbmfvbfkideylhtbl) initialized with canonical 001/002 only via baseline-only workdir; structural parity with Production baseline proven read-only in R4. Production untouched. ACL-01/02 remain expected transitional debt for M11E/M11G.  
STATUS=ACCEPTED  
NEXT=DTH-M11CF_STAGING_BASELINE_FREEZE before M11D  
M11D=NOT_STARTED

---

## DTH-M11CF — Staging Baseline Freeze

DATE=2026-08-13  
DECISION=Freeze clean Staging baseline (DTH-STG-A / deintarifheld-staging / uunpbmfvbfkideylhtbl) with canonical 001/002, structural parity YES vs Production baseline, ACL-01/02 preserved as transitional debt. Production untouched. M11D may begin Staging-only custody work after this freeze; no Production security mutation.  
STATUS=ACCEPTED  
M6=OPEN (unchanged)  
M11D=NOT_STARTED

---

## DTH-M11D-R0 — Ownership/Migration Custody Audit

DATE=2026-08-13  
DECISION=Recommend MODEL_A (postgres remains DDL/migration authority for V1). Custom NOLOGIN/LOGIN owner models deferred; runtime separation remains the primary security boundary (M11F+). Provider-managed roles are DO_NOT_MODIFY.  
STATUS=ACCEPTED_AS_MODEL_A_VIA_M11D_R1  
M11D_R1=PASS  
MUTATION=NO

---

## M11D-V1-MODEL-A — Migration Custody Freeze

DATE=2026-08-13  
DECISION=Retain provider-managed postgres as DTH DDL/migration authority for V1 (MODEL_A). Reject MODEL_B/C/D for V1 (not permanently). Runtime separation remains primary security boundary (M11F+). No new roles/secrets. No ownership transfer. Production DB mutation default=DENY; Staging-first for security migrations. M11E default-privilege principal=postgres.  
STATUS=ACCEPTED  
EXECUTABLE_MIGRATION_GUARD=DEFERRED  
M11E=NOT_STARTED

---

## DTH-M11E-R0 — Pre-Mutation Audit

DATE=2026-08-13  
DECISION=Recommend OPTION_C: quarantine never-governed 003–013 from active supabase/migrations before any M11E security migration. ACL-01 causal source proven as postgres IN SCHEMA public default privileges (no global defaults). Existing object grants remain M11G.  
STATUS=ACCEPTED_AND_EXECUTED_VIA_M11E_P0  
MUTATION=NO (repo paths only)

---

## DTH-M11E-P0 — Migration Queue Reconciliation

DATE=2026-08-13  
DECISION=Archive never-governed 003–013 from active supabase/migrations to archive/supabase-migrations/pre-m11-security/ (byte-identical). Active queue = 001,002. Future migrations timestamp-based; no version reuse. Staging dry-run pending=0. No DB/history mutation.  
STATUS=ACCEPTED  
NEXT=M11E-R1

---

## DTH-M11E-R1A — Security Migration Pre-Apply Freeze

DATE=2026-08-13  
DECISION=Author and freeze timestamp migration 20260813104040_m11e_private_schema_default_privileges.sql (SHA256 04c8dd4b03f840ba641f934d5e1d8bd1ebefb95854f39b1b4c21dd02f44aa4db): create private schemas ops/security/workflow/audit fail-closed; revoke postgres/public schema-specific default privileges for anon/authenticated/service_role on TABLES/SEQUENCES/ROUTINES. Do NOT globally revoke builtin PUBLIC routine EXECUTE. Do NOT touch existing object grants (ACL-02/M11G). R1B may apply exactly this hash to Staging only.  
STATUS=ACCEPTED  
MUTATION=NO (repo + dry-run only)  
NEXT=M11E-R1B
