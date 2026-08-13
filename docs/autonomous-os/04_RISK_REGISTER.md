# Risk Register

Normalized after M8C. One root cause → one ID. Prob/Impact qualitative.

| ID | Description | Prob | Impact | Mitigation | Status | Blocking class |
|---|---|---|---|---|---|---|
| R-001 | Phase-3/4 commits once local-only | High | Critical | M3/M4 + M8C new safety branch | MITIGATED | — |
| R-002 | `/tmp` H0b3d/H0b4 evidence lost | High | High | M7 reconstruction; dual-tier evidence | MITIGATED_PARTIAL | NON_BLOCKING for M9 |
| R-013 | M6 H0b3d historical cleanup unproven | Med | Med | Owner Dashboard readback (Track A) | OPEN | BLOCKING_BEFORE_PRODUCTION_IDENTITY |
| R-MAP | Persistent Clerk→Person mapping absent | High | Critical | H0b-MAP / M13+ | OPEN | BLOCKING_BEFORE_STAGING |
| R-AUTHZ | Strong AuthZ / roles / capabilities absent | High | Critical | H1 / M14–M15 | OPEN | BLOCKING_BEFORE_STAGING |
| R-RLS | No CREATE POLICY; PRODUCTION_RLS_READY=NO | High | Critical | M16–M17 | OPEN | BLOCKING_BEFORE_PRODUCTION |
| R-SVC | Privileged DB/service-role bypasses RLS; least privilege undefined across runtimes | High | Critical | M9 credential/boundary ADR | OPEN | BLOCKING_BEFORE_IMPLEMENTATION / PRODUCTION |
| R-SESS | In-memory session registry (restart/horizontal unsafe) | High | Critical | M9 ADR-007 + M9R: Postgres DTH registry; Clerk≠DTH authority | OPEN (impl) | BLOCKING_BEFORE_PRODUCTION |
| R-KILL | In-memory kill switch (same class as R-SESS) | High | Critical | M9 ADR-008 + M9R last-mile + fail-closed | OPEN (impl) | BLOCKING_BEFORE_PRODUCTION |
| R-STALE | Stale worker sends after human takeover | High | High | M9R CONTROL_VERSION / generation check before external action | OPEN (impl; M10 columns) | BLOCKING_BEFORE_AUTONOMY |
| R-OUTBOX | Provider call without durable intent / blind retry | High | High | M9R corrected outbox order + idempotency + reconcile | OPEN (impl) | BLOCKING_BEFORE_AUTONOMY |
| R-DUAL | Root Next = live public; packages/* = local Ops; web/api skeletons | High | High | **M9 DTH-ERA-A selected** — keep root public; Ops in packages; deprecate skeletons | MITIGATED_DIRECTION (impl pending) | BLOCKING_BEFORE_IMPLEMENTATION until Owner accepts |
| R-MIG | Public+Ops SQL share `supabase/migrations`; drafts also under packages/db | Med | High | **M9 ADR-016**: drafts=design source; supabase=apply root; owners/gates; schemas → M10 | OPEN_PARTIAL | BLOCKING_BEFORE_IMPLEMENTATION |
| R-STG | No production-like staging | High | High | M18 | OPEN | BLOCKING_BEFORE_STAGING |
| R-MON | Monitoring/audit production completeness unclear | Med | High | Later observability tranche | OPEN | BLOCKING_BEFORE_PRODUCTION |
| R-REC | H0b3c recovery deferred | Med | Med | Later Owner gate | OPEN | BLOCKING_BEFORE_PRODUCTION_IDENTITY |
| R-IDP | H0b5 custom FAPI/DNS / prod IdP deferred | Med | High | Later identity cutover | OPEN | BLOCKING_BEFORE_PRODUCTION_IDENTITY |
| R-MAIL | Customer mail disabled / domain unproven | Med | High | After AuthZ/RLS | OPEN | BLOCKING_BEFORE_AUTONOMY |
| R-AUTO | No durable automation runtime | High | High | M21–M24 | OPEN | BLOCKING_BEFORE_AUTONOMY |
| R-CI | Package auth tests not in CI | Med | High | After architecture freeze | OPEN | NON_BLOCKING for M9 |
| R-CAPTCHA | Server-side reCAPTCHA on Vercel API absent | Med | Med | Hardening later | OPEN | NON_BLOCKING for M9 |
| R-ENV | Untracked `.env.local` on workstation | Med | High | Never commit; rotate if exposed | OPEN_WATCH | — |
| R-GOOG | Legacy Google backup owner unresolved | Low | Med | Parallel compliance | DEFERRED | NON_BLOCKING |
| R-FREEZE | Treating M6 as global engineering freeze | Med | High | D-009 track split | MITIGATED | — |

Retired duplicates (mapped into above): former R-003→R-DUAL, R-004→R-MIG/R-DUAL, R-006→R-AUTHZ, R-007→R-RLS, R-011/R-012→R-KILL/R-SESS, R-016→R-FREEZE, R-017→R-SESS/R-KILL, R-018→R-AUTHZ+R-RLS+R-MAP, R-019→R-DUAL.

## M9F RISK NORMALIZATION

ARCHITECTURE_TARGET_DECISIONS_ARE_NOT_OPEN_ARCHITECTURE_RISKS=YES  
Remaining items below are implementation / evidence / Track-A gaps.

Canonical open implementation / evidence risks (minimum set):
- M6 historical identity evidence (OWNER_READBACK_PENDING)
- Current broad service_role on public path
- Missing persistent person mapping
- Missing strong AuthZ
- Missing RLS policies (CREATE_POLICY_COUNT=0)
- Current in-memory session control
- Current in-memory kill control
- No staging environment
- Data/migration topology unresolved until M10 (conditional, not architecture reject)
- Monitoring/audit implementation incomplete
- Recovery proof incomplete
- Future workflow durability not implemented
- Future stale-execution controls not implemented

## M10 RISK UPDATE

Architecture decisions closed for topology/SoT/role model (pending M10R). Remaining implementation risks:

- Current broad service_role + BYPASSRLS on public path (until retirement cutover)
- CREATE_POLICY_COUNT=0
- Missing durable person mapping / session / kill / workflow tables
- Missing strong App AuthZ
- Ops migrations 003–013 not production-proven
- Dual draft vs promoted migration roots (authority decided; cleanup not executed)
- Retention durations LEGAL_REVIEW_REQUIRED
- Backup restore vs provider resend reconciliation not implemented
- M6 identity evidence still OPEN (Track A)

DATA_TOPOLOGY_UNRESOLVED=NO (selected DTH-DT-A; M10R may challenge)

## M10R RISK UPDATE

Closed as architecture gaps (now decided): role assumption, schema exposure, intake atomicity mechanism, operator vs party, restore privacy process, kill linearization honesty.

Remain as implementation risks until M11+/cutover:
- Live service_role still in production path
- Physical schemas not yet created
- LOGIN roles/grants not created
- privacy_operations ledger not implemented
- FORCE RLS not applied
- M6 OPEN

## M10F RISK NORMALIZATION

Architecture topology/principals/schemas/atomicity/identity/restore are DECIDED (not open architecture risks).

Open implementation / evidence risks:
- Current broad service_role on public path
- CREATE_POLICY_COUNT=0
- Missing persistent OPERATOR_PERSON mapping
- Missing EXTERNAL_PARTY persistence
- Missing Strong AuthZ
- In-memory session/kill
- No staging
- Physical schemas not created
- LOGIN roles/grants/ownership not implemented
- Request-scoped DB identity context not implemented
- Atomic Intake target not implemented
- Outbox/workflow/control persistence incomplete
- Restore privacy replay not implemented
- Monitoring/recovery incomplete
- M6 OPEN
- Retention durations LEGAL_REVIEW_REQUIRED

## M11A PLAN RISK UPDATE

New explicit planning risks (not architecture undecided):
- PRODUCTION_MIGRATION_STATE=PARTIAL until M11B
- Pooler mode vs request-scoped set_config unproven until M11K
- Hybrid public intake table location during transition (compatibility phase)
- Owner/provider actions required for staging + Data API exposure config

Mitigation: M11B first; staging before cutover; no service_role retirement before gates.

## M11B RISK UPDATE

- Remote production migration history / schema metadata not yet observed in this environment (CLI absent; no new credentials).
- Until Owner readback: cannot confirm 003–013 absence or 001–002 schema match.
- Dual-apply risk of drafts vs 003–013 remains (bodies equivalent) — still DO_NOT_APPLY drafts.

## M11B FINAL RISK UPDATE

Closed: unknown Production migration apply-state for 001–013 (now PROVEN: 001–002 present, 003–013 absent).

Open implementation risks (not architecture undecided):
- M11B-ACL-01 broad public default privileges → M11E
- M11B-ACL-02 broad anon/authenticated/service_role table grants → M11G
- Live service_role BYPASSRLS path remains until M11S
- FORCE_RLS=false (expected current; later review)
- No dth_* LOGIN roles yet

## M11ABF RISK NORMALIZATION

CLOSED as uncertainty:
- Production migration apply-state for 001–013 (now PROVEN via M11B)

OPEN implementation / evidence risks:
- M11B-ACL-01 broad public default privileges → M11E
- M11B-ACL-02 broad object grants → M11G
- Live service_role BYPASSRLS path → M11S
- No private schemas / no dth_* LOGIN roles
- No Strong AuthZ / no RLS policies
- In-memory session/kill
- No staging environment
- FORCE_RLS=false (current; later review)
- PERSISTENT_RAW_EVIDENCE_LOCATION=DEGRADED_WORKSPACE_GITIGNORED
- M6 OPEN
- Retention durations LEGAL_REVIEW_REQUIRED

## M11C OPEN BLOCKERS

- Staging project not yet created (blocks all Staging apply/readback)
- Supabase CLI unavailable in execution context (blocks canonical remote apply without Owner tooling approval)
- Repo link metadata points at Production — mutation through that context forbidden
- R-STG remains OPEN until Staging baseline proven

## M11C STAGING FOUNDATION

CLOSED / mitigated by M11C PASS:
- No staging environment (R-STG foundation established)
- Unknown Staging apply mechanism (baseline-only workdir proven)

REMAINS OPEN (expected):
- M11B-ACL-01 / M11B-ACL-02 (also reproduced on Staging; harden in M11E/M11G)
- No private schemas / dth_* roles / Strong AuthZ / RLS policies
- service_role bypass path
- M6 OPEN

## M11CF RISK NORMALIZATION

CLOSED / downgraded:
- R-STG / no staging environment — dedicated Staging proven and frozen

OPEN (expected pre-M11D+):
- M11B-ACL-01 (reproduced in Staging) → M11E
- M11B-ACL-02 (reproduced in Staging) → M11G
- service_role BYPASSRLS transition debt → M11S
- private schemas / dth_* LOGIN roles / least-privilege grants NOT_IMPLEMENTED
- Strong AuthZ / request context / target RLS policies NOT_IMPLEMENTED
- in-memory session/kill
- Staging external provider safety not yet configured for future runtime
- M6 OPEN
- retention legal review

## M11D RISK NORMALIZATION

OPEN:
- ADMIN_POSTGRES_CREDENTIAL_BLAST_RADIUS — postgres remains powerful admin principal; mitigate via Owner custody, no runtime distribution, Staging-first gates, future CI/custom-runner reconsideration triggers
- M11B-ACL-01 / M11B-ACL-02 (M11E/M11G)
- service_role runtime debt (M11S)
- runtime roles / private schemas / Strong AuthZ / target RLS not implemented
- M6 OPEN

CLOSED by M11D:
- uncertainty whether V1 requires custom DDL owner / migration LOGIN — resolved as MODEL_A (no)

## M11E-P0 RISK NORMALIZATION

CLOSED:
- ACTIVE_MIGRATION_QUEUE_CONTAINS_NEVER_GOVERNED_003_013 (archived; Staging dry-run pending=0)

OPEN:
- ACL-01 (POSTGRES_PUBLIC_SCHEMA_DEFAULT) → M11E-R1
- FUNCTION_PUBLIC_EXECUTE_DEFAULT_DESIGN → M11E-R1 blast-radius decision
- ACL-02 → M11G
- service_role debt / later security risks / M6

## M11E-R1A RISK POSITION

FROZEN_PENDING_R1B_R2:
- ACL-01 implementation migration authored/hashed; not yet applied

CLOSED_AS_DESIGN_DECISION (R1A):
- Global postgres PUBLIC routine EXECUTE default revoke → DEFER (provider blast radius unproven)
- Mitigation: DTH_ROUTINES_IN_PUBLIC_BY_DEFAULT=FORBIDDEN; private schema USAGE deny; explicit per-object review

OPEN:
- DTH-RISK-FUNCTION-PUBLIC-EXECUTE (builtin PUBLIC EXECUTE remains; not claimed solved)
- DTH-RISK-TYPE-PUBLIC-USAGE (low; prefer private schemas; no global type default change)
- ACL-01 proof → R1B/R2
- ACL-02 → M11G
- service_role debt / M6

## M11E-R1B RISK POSITION

CLOSED_IN_STAGING_CONFIG:
- Private schemas ops/security/workflow/audit present + API-role USAGE/CREATE denied
- postgres/public explicit API-role default ACLs removed (tables/sequences/routines)

STILL_OPEN:
- ACL-01_RESOLVED=NO until R2 disposable-object negative tests
- DTH-RISK-FUNCTION-PUBLIC-EXECUTE (global builtin PUBLIC EXECUTE unchanged by design)
- DTH-RISK-TYPE-PUBLIC-USAGE
- ACL-02 → M11G
- service_role debt / M6

## M11E-R2 RISK POSITION

PROVEN_RESOLVED (Staging behavior):
- ACL_01 table default auto-grants to anon/authenticated/service_role
- ACL_01 sequence default auto-grants to anon/authenticated/service_role
- ACL_01 explicit routine API-role default grants

CONFIRMED_OPEN (single canonical risk — do not duplicate):
- DTH-RISK-FUNCTION-PUBLIC-EXECUTE / PUBLIC_ROUTINE_FAIL_CLOSED_GAP
  - Evidence: new public.__dth_m11e_r2_fn has proacl=NULL (no explicit API grants) but has_function_privilege(...EXECUTE)=true for anon/authenticated/service_role via PUBLIC
  - Supabase guidance recommends creator-role global REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC for opt-in; not applied in R2
  - Private schemas: object EXECUTE may be true via PUBLIC, but USAGE=false → call path blocked by schema boundary

STILL_OPEN:
- ACL-02 → M11G
- DTH-RISK-TYPE-PUBLIC-USAGE (low)
- service_role debt / M6
