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