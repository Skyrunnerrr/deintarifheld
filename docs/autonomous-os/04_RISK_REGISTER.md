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

