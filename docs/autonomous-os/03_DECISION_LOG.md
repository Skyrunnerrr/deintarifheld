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
