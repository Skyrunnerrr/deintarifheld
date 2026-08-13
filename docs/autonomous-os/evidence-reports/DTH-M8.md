# DTH-M8 — Phase-4 Current-State Reconciliation

STATUS=PASS  
AS_OF_UTC=2026-08-13T05:40:00Z  
BASELINE_HEAD=5e6950698111cf1837c77d0882e35d6fa83e2731  
H0B4_IMPL_COMMIT=955e849d3f9006910a989727d9f21608a2f682e6  
COMMITTED=NO  
SOURCE_CODE_CHANGED=NO  

## Classification

OBSERVED · INFERRED · UNKNOWN · NOT_IMPLEMENTED · UNAVAILABLE_WITH_CURRENT_ACCESS · UNAVAILABLE_DUE_TO_HISTORICAL_EVIDENCE_GAP

## Pre-flight (OBSERVED)

```text
HEAD=5e6950698111cf1837c77d0882e35d6fa83e2731
BRANCH=feat/deintarifheld-production-cutover-001
WORKTREE=DIRTY_GOVERNANCE_ONLY
SOURCE_DIFF_VS_GOVERNANCE_COMMIT=EMPTY
M6_STATUS=OPEN
M7_STATUS=PASS
M8_PRE_FLIGHT=PASS
```

---

## 1. Phase-4 Tranche Matrix (canonical)

| Tranche | Purpose | Implementation | Local Evidence | Remote Evidence | Production | Gap | Blocking Class | Canonical Status |
|---|---|---|---|---|---|---|---|---|
| P4-H0a | Local identity / JWT / session / passkey contracts | Code present | E2 (suite subset) | N/A (synthetic) | NOT_READY | Persistent mapping deferred | BLOCKING_BEFORE_PRODUCTION_IDENTITY | LOCAL_FOUNDATION_COMPLETE |
| P4-H0b1 | Clerk Dev bootstrap / restricted auth | Provider config (historical) | E1 docs | CURRENT_READBACK=UNPROVEN | NO | No current Dashboard proof | BLOCKING_BEFORE_PRODUCTION_IDENTITY | HISTORICALLY_REPORTED_CURRENT_UNPROVEN |
| P4-H0b2a | Remote JWKS + aud/azp | Code + tests | E2 | Public JWKS historically validated; live authenticated session/token proof not this tranche | NO | LIVE_AUTHENTICATED_DEVELOPMENT_SESSION_OR_PROVIDER_READBACK (Clerk Secret NOT required for JWKS) | BLOCKING_BEFORE_STAGING | LOCAL_COMPLETE |
| P4-H0b3a | Invite + OTP enrollment | Historical live | E0 process | UNPROVEN (M6) | NO | Invitation state | BLOCKING_BEFORE_PRODUCTION_IDENTITY | HISTORICAL_ACTION_REPORTED_CURRENT_UNPROVEN |
| P4-H0b3b | Passkey before local CC entry | Code + tests | E2 | Historical live; current UNPROVEN | NO | Live re-proof optional | BLOCKING_BEFORE_STAGING | LOCAL_COMPLETE_DEV_ONLY |
| P4-H0b2b | Live Dev token via JWKS | Code path + synthetic tests | E2 synthetic | Historical live reported; CURRENT_REPRODUCIBILITY=UNAVAILABLE_WITH_CURRENT_ACCESS | NO | Live session re-proof | BLOCKING_BEFORE_STAGING | HISTORICAL_REMOTE_TEST_NOT_CURRENTLY_REPRODUCIBLE |
| P4-H0b4 | Session lifecycle | Code + 125 suite | E2 PASS_LOCAL | Live revoke/disable UNAVAILABLE | NO | In-memory registry; live provider proofs | BLOCKING_BEFORE_PRODUCTION | LOCAL_COMPLETE_NOT_PRODUCTION_SAFE |
| P4-H0b3d | Cleanup test user/passkey | Historical claim | E0 | M6 OPEN | NO | Full M6 gap set | BLOCKING_BEFORE_PRODUCTION_IDENTITY | OPEN_PARALLEL_TRACK_A |
| P4-H0b3c | Recovery test | None in repo | — | — | — | Intentionally deferred (Owner cycle) | BLOCKING_BEFORE_PRODUCTION_IDENTITY | DEFERRED |
| P4-H0b5 | Custom FAPI / DNS | None | — | Deferred per H0b2a docs | — | Prod custom domain | BLOCKING_BEFORE_PRODUCTION_IDENTITY | DEFERRED — does NOT block M9/M10 docs |
| P4-H0b-MAP | Persistent Clerk→Person | NOT_IMPLEMENTED | Adapter in-memory only | — | — | Mapping + persistence | BLOCKING_BEFORE_STAGING / PRODUCTION | NOT_IMPLEMENTED |
| P4-H1 | Strong AuthZ | NOT_IMPLEMENTED | Synthetic owner gate only | — | — | Roles/capabilities/resource | BLOCKING_BEFORE_STAGING | NOT_IMPLEMENTED |
| P4-H2 / RLS prod | Person/resource RLS policies | ENABLE RLS, **zero CREATE POLICY** | Local drafts E1 | — | NO | Policies + negative tests | BLOCKING_BEFORE_PRODUCTION | NOT_IMPLEMENTED (policies) |

---

## 2. Authentication Baseline

| Capability | Implemented | Tested local | Remote proven | Production proven |
|---|---|---|---|---|
| Signature / RS256 validation | YES | E2 | Historical JWKS | NO |
| Issuer checks | YES | E2 | Partial (Dev issuer) | NO |
| Audience `urn:deintarifheld:ops-api` | YES | E2 | Historical config claim | NO |
| azp allowlist (localhost:3100 + prod origin) | YES | E2 | Historical | NO |
| Principal conversion (person only) | YES | E2 | — | NO |
| Mapping interface | YES (in-memory) | E2 | Live uses empty map | NO |
| Session policy evaluator | YES | E2 | — | NO |
| Passkey policy contract | YES | E2 | Historical enroll | NO |
| Fail-closed unknown/disabled | YES local | E2 | — | NO |
| Clerk Backend Secret for JWKS | NOT_REQUIRED (public JWKS adapter; OBSERVED in code/docs) | — | — | — |
| Authenticated Dev session/token for live E2E | Required for live AuthN proof (H0b2b class) | — | UNAVAILABLE_WITH_CURRENT_ACCESS | — |

**OBSERVED:** Live CC validate path uses empty person mapping → AuthN can PASS, DTH AuthZ DENIED (by design).

---

## 3. Session Security Baseline

| Control | Status | Evidence level |
|---|---|---|
| SESSION_POLICY_IMPLEMENTATION (30m / 12h / max1 / REVOKE_OLD) | PRESENT | E2 |
| LOCAL_SESSION_ENFORCEMENT | PRESENT (in-memory registry) | E2 |
| REMOTE_PROVIDER_REVOCATION_PROOF | UNAVAILABLE_WITH_CURRENT_ACCESS | E0 now |
| PRODUCTION_SESSION_ENFORCEMENT | NOT_IMPLEMENTED | — |
| Horizontal multi-instance safety | UNSAFE_BY_DESIGN if scaled (process memory) | INFERRED from OBSERVED `persistent: false` |

Do **not** label H0b4 production-ready.

---

## 4. Person Mapping Baseline

```text
AUTHENTICATION_FOUNDATION=PARTIAL_LOCAL
PERSON_MAPPING_INTERFACE=PRESENT_IN_MEMORY
PERSISTENT_PERSON_MAPPING=NOT_IMPLEMENTED
OPERATIONAL_OPERATOR_AUTHORIZATION=NOT_IMPLEMENTED
TEMPORARY_PERSON_MAPPING_AUTHORIZED=false  (passkey gate contract)
```

---

## 5. Authorization Baseline

```text
STRONG_AUTHZ_COMPLETE=NO
CURRENT_LOCAL_AUTHZ_MODE=SYNTHETIC_OWNER_ONLY_DEV_GATE
ROLE_RESOLUTION=NOT_IMPLEMENTED
CAPABILITY_RESOLUTION=NOT_IMPLEMENTED  (kill evaluateCapabilityEnabled ≠ RBAC)
RESOURCE_SCOPED_AUTHZ=NOT_IMPLEMENTED
SERVER_AUTHZ_PRODUCTION=NOT_IMPLEMENTED
```

**OBSERVED:** `packages/ops-api/src/bff/auth-gate.js` allows only synthetic Owner person id locally; SERVICE/BREAK_GLASS rejected.

---

## 6. RLS Baseline

```text
LOCAL_SCHEMA_FOUNDATION=PRESENT (migrations 003–013 LOCAL_APPLY_ONLY)
RLS_ENABLED_DEFAULT_DENY=YES (ENABLE + REVOKE; no public policies)
CREATE_POLICY_COUNT=0
PRODUCTION_RLS=NOT_IMPLEMENTED
PRODUCTION_RLS_READY=NO (explicit in migrations/docs)
```

Public leads (`001`–`002`): RLS enabled; access via **service role** only (OBSERVED comment). That is intake isolation, **not** Ops person-bound RLS.

---

## 7. Principal Matrix

| Principal | Defined | Implemented | Authenticated path | Authorized for CC/Ops | Production ready |
|---|---|---|---|---|---|
| PERSON | YES | YES | Local + Clerk path | Synthetic owner only (local) | NO |
| SERVICE | YES | Type + reject | N/A as CC | Rejected for CC | NO |
| BREAK_GLASS | YES | Type + reject | N/A as CC | Rejected for CC | NO |
| AGENT | NO | NOT_IMPLEMENTED | — | — | NO |
| SYSTEM | NO as principal | NOT_IMPLEMENTED | — | — | NO |

---

## 8. Environment Matrix

| Surface | LOCAL | STAGING | PRODUCTION |
|---|---|---|---|
| Public Web | Root Next | NOT_IMPLEMENTED as named staging | LIVE (Checkdomain / prior E5) |
| Public API | Root / Vercel leads API | NOT_IMPLEMENTED staging twin | LIVE leads API (prior E5) |
| Ops API | packages/ops-api LOCAL_ONLY | NOT_IMPLEMENTED | NOT_DEPLOYED |
| Command Center | packages/cc localhost:3100 | NOT_IMPLEMENTED | NOT_DEPLOYED |
| Database leads | Supabase prod (intake) | UNKNOWN staging | LIVE |
| Database ops | Local migrations | NOT_IMPLEMENTED | NOT_APPLIED_AS_PROVEN |
| Identity Provider | Clerk Dev (config claims) | NOT_IMPLEMENTED | NOT_ACTIVATED |
| Worker | Stub LOCAL | NOT_IMPLEMENTED | NOT_ACTIVATED |
| Automation | Fail-closed OFF | — | OFF |
| Mail customer | Disabled | — | DISABLED |
| Monitoring | Minimal / UNKNOWN | — | UNKNOWN |

---

## 9. Security Control Matrix (Phase-4)

| CONTROL | Implementation | Local | Remote | Prod | Status | Blocking |
|---|---|---|---|---|---|---|
| Authentication JWT | YES | E2 | Partial hist. | NO | PARTIAL | BLOCKING_BEFORE_PRODUCTION |
| Passkey requirement (local CC) | YES | E2 | Hist. | NO | DEV_ONLY | BLOCKING_BEFORE_STAGING |
| Session timeout 30m | YES local | E2 | UNAVAIL live | NO | PASS_LOCAL | BLOCKING_BEFORE_PRODUCTION |
| Session lifetime 12h | YES local | E2 | UNAVAIL | NO | PASS_LOCAL | BLOCKING_BEFORE_PRODUCTION |
| Single session + revoke-old | YES in-memory | E2 | UNAVAIL | NO | PASS_LOCAL_UNSAFE_SCALE | BLOCKING_BEFORE_PRODUCTION |
| Provider session revocation | Modeled | E2 | UNAVAIL | NO | UNAVAILABLE | BLOCKING_BEFORE_PRODUCTION |
| User disablement | Contract/tests | E2 | UNAVAIL live | NO | UNAVAILABLE | BLOCKING_BEFORE_PRODUCTION_IDENTITY |
| Unknown principal denial | YES | E2 | — | — | PASS_LOCAL | — |
| Person mapping | NOT_IMPLEMENTED persistent | E2 empty | — | — | NOT_IMPLEMENTED | BLOCKING_BEFORE_STAGING |
| Role/capability/resource AuthZ | NOT_IMPLEMENTED | Synthetic only | — | — | NOT_IMPLEMENTED | BLOCKING_BEFORE_STAGING |
| RLS policies | NOT_IMPLEMENTED | ENABLE only | — | NO | NOT_IMPLEMENTED | BLOCKING_BEFORE_PRODUCTION |
| Secrets / live session custody | Publishable+FAPI local; Backend Secret not required for JWKS; live session token for E2E UNAVAILABLE | — | — | — | PARTIAL | BLOCKING_BEFORE_STAGING (live session proof, not JWKS secret) |
| Kill switch | In-memory | E2 | — | NO | LOCAL_ONLY | BLOCKING_BEFORE_PRODUCTION |
| Audit | Local schemas + in-memory kill audit | E1/E2 | — | NO | PARTIAL | BLOCKING_BEFORE_PRODUCTION |
| Monitoring | UNKNOWN / minimal | — | — | — | UNKNOWN | BLOCKING_BEFORE_PRODUCTION |
| Recovery (H0b3c) | DEFERRED | — | — | — | DEFERRED | BLOCKING_BEFORE_PRODUCTION_IDENTITY |
| Break glass | Type exists; cannot be CC operator | E2 | — | — | CONTRACT_ONLY | — |

---

## 10. Historical Evidence Gaps (preserved from M6/M7)

| Gap | Status |
|---|---|
| G-M6-01…05 | OPEN — BLOCKING_BEFORE_PRODUCTION_IDENTITY |
| G-H0B4-01 live revoke/disable | UNAVAILABLE_WITH_CURRENT_ACCESS — BLOCKING_BEFORE_PRODUCTION |
| G-H0B4-02 in-memory session registry | OBSERVED — BLOCKING_BEFORE_PRODUCTION |
| G-TMP-01 /tmp loss | MITIGATED_PARTIAL via M7 — NON_BLOCKING for M9 |

No reinterpretation; M6 remains OPEN.

---

## 11. Normalized Open Gaps (Phase-4)

| GAP_ID | ROOT_CAUSE | CONTROL | BLOCKING_CLASS | REQUIRED_BEFORE | NEXT |
|---|---|---|---|---|---|
| G-P4-MAP | No persistent Clerk→Person | Person mapping | BLOCKING_BEFORE_STAGING | Staging / prod identity | H0b-MAP / M13+ |
| G-P4-AUTHZ | No roles/capabilities/resource AuthZ | Strong AuthZ | BLOCKING_BEFORE_STAGING | Staging | H1 / M14–M15 |
| G-P4-RLS | No CREATE POLICY | RLS | BLOCKING_BEFORE_PRODUCTION | Production | M16–M17 |
| G-P4-SESS-STORE | In-memory session/kill stores | Session / kill | BLOCKING_BEFORE_PRODUCTION | Multi-instance prod | Design in M9 + later impl |
| G-P4-LIVE-PROOF | No current authenticated Dev session/token re-proof (JWKS itself needs no secret) | AuthN E2E | BLOCKING_BEFORE_STAGING | Staging E2E | Owner/M6 + controlled live tests |
| G-P4-M6 | Historical cleanup unproven | Identity hygiene | BLOCKING_BEFORE_PRODUCTION_IDENTITY | Prod identity closure | Track A M6 |
| G-P4-H0B3C | Recovery deferred | Recovery | BLOCKING_BEFORE_PRODUCTION_IDENTITY | Prod identity | Later Owner gate |
| G-P4-H0B5 | Custom FAPI/DNS deferred | Prod IdP UX | BLOCKING_BEFORE_PRODUCTION_IDENTITY | Prod cutover | H0b5 when authorized |
| G-P4-DUAL-RUNTIME | Root public vs packages skeletons | Architecture | BLOCKING_BEFORE_M9? → **OPEN_NON_BLOCKING for starting M9; BLOCKING_BEFORE_IMPLEMENTATION of wrong surface** | M9 ADR | M9 |
| G-P4-STAGING | No staging env | Environments | BLOCKING_BEFORE_STAGING | Staging | M18 |
| G-P4-MONITOR | Observability unclear | Monitoring | BLOCKING_BEFORE_PRODUCTION | Production | Later |

---

## 12. Architecture Debt Findings (OBSERVED)

| ID | Finding |
|---|---|
| AD-01 | **Root Next.js** is live public web/API; `packages/web` + `packages/api` remain skeletons — dual plane. |
| AD-02 | Parallel auth: `DTH-Local` synthetic owner (ops-api) vs Clerk Bearer validate (cc) with empty mapping. |
| AD-03 | In-memory session registry + kill store — local E2 green, **unsuitable to extend as production multi-instance design**. |
| AD-04 | `skeletonOnly` markers still on ops-api/cc package metadata while shipping real local modules — stale signaling. |
| AD-05 | Dual migration trees: `packages/db/migrations/drafts` + `supabase/migrations/003+`. |
| AD-06 | Kill-switch `evaluateCapabilityEnabled` name suggests AuthZ; is not RBAC. |
| AD-07 | **CURRENT_PHASE4_DESIGN_SHOULD_NOT_BE_EXTENDED_AS_IS** for production session/kill/AuthZ — must be redesigned in M9 before building autonomy on top. |

M8 conclusion: local Phase-4 security **foundation** is valuable; **do not** treat it as the production runtime architecture.

---

## 13. Adversarial Security Review

| # | Question | Result |
|---|---|---|
| 1 | Unmapped Clerk user reach operational data? | **PROVEN_SAFE** locally (empty map + gate denies operational API; synthetic owner gate). Production CC not deployed. |
| 2 | Service → human session? | **PROVEN_SAFE** in local gates (rejected). |
| 3 | Break-glass → normal operator? | **PROVEN_SAFE** in local gates (rejected). |
| 4 | Client-side AuthZ reliance? | **UNKNOWN** for any future UI; current ops reads go through BFF gate. CC shell is non-operational by contract. |
| 5 | RLS absence if AuthZ fails? | **PROVEN_UNSAFE** for Ops if deployed without policies: RLS enabled but **no CREATE POLICY**; service-role bypass is the real access path — app AuthZ is single layer. |
| 6 | Session registry memory-only? | **PROVEN_UNSAFE** for multi-instance/restart guarantees. |
| 7 | Max-one-session horizontally? | **PROVEN_UNSAFE** under horizontal scale (same as #6). |
| 8 | Provider revocation enforced or modeled? | **UNKNOWN** current live; modeled locally (**PROVEN_SAFE** E2 only). |
| 9 | Stale mapping after disablement? | **NOT_APPLICABLE** persistent mapping absent; in-memory would need process restart — **UNKNOWN** for future map. |
| 10 | AuthN success defaults allow AuthZ? | **PROVEN_SAFE** locally (deny without mapping / non-owner). |
| 11 | Unknown principals fail closed? | **PROVEN_SAFE** locally. |
| 12 | Audit reconstruct privileged actions? | **UNKNOWN**/PARTIAL — local kill audit in-memory; ops audit schema exists but not production-proven. |

---

## 14. Technical Privacy Risks (not legal conclusions)

| Risk | Note |
|---|---|
| Live public lead data | Accessible to holders of **Supabase service role** / Vercel API runtime secrets; browser RLS denies anon. |
| Local Ops data | Synthetic owner local session; not proven against production leads DB. |
| CC personal data | Local read models; production CC not deployed — should not claim live PII UI. |
| Person-bound access | NOT_IMPLEMENTED. |
| Prod deploy least-privilege | Would currently violate expectations if Ops/CC deployed without AuthZ+RLS+mapping. |
| Dev credentials → prod data | UNKNOWN without secret inventory; FAPI is `.clerk.accounts.dev` (Dev hint). |

---

## 15. Dependency Graph (verified)

```text
M6 Historical Closure ──► Production Identity Closure
H0b5 (DNS/FAPI) ─────────► Production Identity Cutover (not M9 docs)
H0b3c Recovery ──────────► Production Identity Closure

M9 Canonical Runtime Architecture  ◄── may proceed now (docs/ADR)
M10 Canonical Data / SoT           ◄── may proceed after/with M9 (docs/ADR)

H0b-MAP ─► Strong AuthZ (H1) ─► RLS policies ─► Staging E2E
        ─► Production Identity ─► Production CC/Ops ─► Automation
```

**Difference vs naive copy:** M9/M10 documentation are **not** blocked by M6. Implementation that touches production identity **is**.

---

## 16. Phase-4 Canonical Exit Status

Human summary (non-machine):
Local security foundation complete; remote Development proofs only partial; production security not ready.

Machine-readable fields:

```text
PHASE4_LOCAL_FOUNDATION=PASS
PHASE4_REMOTE_DEV_EVIDENCE=PARTIAL
PHASE4_STAGING_READY=NO
PHASE4_PRODUCTION_READY=NO

PHASE4_EXIT_TO_ARCHITECTURE_ALLOWED=YES
PHASE4_EXIT_TO_IMPLEMENTATION_ALLOWED=NO
PHASE4_EXIT_TO_STAGING_ALLOWED=NO
PHASE4_EXIT_TO_PRODUCTION_ALLOWED=NO
```

### H0b2a terminology correction (M8C)

```text
H0B2A_SECRET_DEPENDENCY=NOT_REQUIRED
H0B2A_ACTUAL_LIVE_EVIDENCE_GAP=LIVE_AUTHENTICATED_DEVELOPMENT_SESSION_OR_PROVIDER_READBACK
```

OBSERVED: `remote-jwks-adapter.js` is `REMOTE_PUBLIC_JWKS`; architecture doc states “No Clerk SDK. No secret key.”

### RLS vs service-role (M8C — design requirement for M9, not a solution)

```text
CURRENT_RLS_STATUS=ENABLE_DEFAULT_DENY_NO_CREATE_POLICY
SERVICE_ROLE_BYPASS_RISK=YES
```

RLS does **not** protect against a privileged service-role/DB principal that bypasses RLS. Public lead intake currently uses server-side privileged access (OBSERVED). M9 must define runtime→credential→schema boundaries and least privilege independent of human-user RLS.

### In-memory controls (M8C)

```text
IN_MEMORY_SESSION_REGISTRY=LOCAL_DEVELOPMENT_ONLY
IN_MEMORY_KILL_SWITCH=LOCAL_DEVELOPMENT_ONLY
SESSION_REGISTRY_PRODUCTION_SUITABLE=NO
KILL_SWITCH_PRODUCTION_SUITABLE=NO
```

### Migration / data boundary (M8C — observation only)

```text
CURRENT_PUBLIC_DB_MIGRATION_OWNER=supabase/migrations (001–002 public leads; apply path for public intake)
CURRENT_OPS_DB_MIGRATION_OWNER=supabase/migrations (003–013 LOCAL_APPLY_ONLY) with drafts under packages/db/migrations/drafts/p3-f2a (DO_NOT_APPLY until promoted)
OVERLAP=same supabase/migrations tree hosts both public and ops SQL files
CONFLICT_RISK=MEDIUM — ambiguous ownership if both planes evolve without ADR
CANONICAL_DECISION_REQUIRED_IN=M9/M10
```

---

## 17. M8 Gate

```text
M8=PASS
Reason=Every known Phase-4 tranche reconciled; local vs remote vs production separated; M6 gaps preserved; gaps normalized; AuthZ/RLS/identity/environment explicit; debt and adversarial findings recorded; no implementation; no invented production PASS; M9 docs preconditions decided.
```

---

## 18. Exact M9 Preconditions

| Condition | Class |
|---|---|
| M8 PASS persisted for Owner review | SATISFIED (this report; uncommitted) |
| No source mutation during M8 | SATISFIED |
| Root vs packages dual-plane acknowledged as ADR input | SATISFIED (OPEN_NON_BLOCKING to *start* M9) |
| M6 PASS | OPEN_NON_BLOCKING for M9 docs |
| Persistent person mapping | OPEN_NON_BLOCKING for M9 docs; BLOCKING for later impl/staging |
| Strong AuthZ / RLS | OPEN_NON_BLOCKING for M9 docs |
| Production session store design | Must be decided in M9 (not extend in-memory as-is) — SATISFIED as known constraint |
| Staging environment | OPEN_NON_BLOCKING for M9 docs |

**No BLOCKING prerequisite prevents starting DTH-M9 documentation/ADR work.**

---

## 19. Recommended Next

```text
RECOMMENDED_NEXT_TRANCHE=DTH-M9
PARALLEL_TRACK_A=DTH-M6 Owner Dashboard readback
```

M9 not started in this tranche.
