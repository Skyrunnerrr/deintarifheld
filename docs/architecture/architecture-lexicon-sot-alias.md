# Architecture Lexicon — SoT, Aliases, Milestones (J-F-05 Closure)

STATUS=CLOSED_WITH_EVIDENCE  
TRANCHE=P3-F7  
INFERENCE_USED=NO  
OWNER_DEFERRAL=NO  

This document closes J-F-05 by consolidating already-accepted Phase-1/Phase-2/Phase-3 lexicon evidence in-repo.

## A. FIRST_RESPONSE

CLAIM=`FIRST_RESPONSE` is a milestone (first operational reaction / triage timestamp), not a communications entity.  
SOURCE_DOCUMENT=/tmp/dth-phase-1-operating-model/07-process-catalog.md  
SOURCE_SECTION=Canonical map — FIRST_RESPONSE row  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_1  

CLAIM=`FIRST_RESPONSE` is not a CommsEvent type and not a dual contact entity.  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/10-data-architecture.md  
SOURCE_SECTION=FIRST_RESPONSE milestone note  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_2  

CLAIM=Store/emit SoT IDs for contact/note; `FIRST_RESPONSE` remains milestone only.  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/12-api-cc-architecture.md  
SOURCE_SECTION=SoT rules item 1  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_2  

CLAIM=`FIRST_RESPONSE` is not an alias for contact attempts and not a stored comms entity (Phase-3 local docs).  
SOURCE_DOCUMENT=docs/architecture/p3-f3-ops-bff-sot-alias-lock.md  
SOURCE_SECTION=SoT Alias Lock  
SOURCE_STATUS=P3-F3_ACCEPTED  

RULES=
- FIRST_RESPONSE_EQUALS_CONTACT_ATTEMPT=NO
- A contact attempt is a separate SoT/alias path (`CONTACT_ATTEMPT` → communication event); it is not definitionally the same as the FIRST_RESPONSE milestone (Phase-1 canonical map: milestone does **not** replace a comms event).

## B. INTERNAL_NOTE

| Layer | Value |
|---|---|
| API/BFF alias | `INTERNAL_NOTE` |
| Canonical resource type | `CASE_NOTE` |
| Canonical persistence | `case_notes` (`CASE_NOTE_RECORDED`) |

RULE=INTERNAL_NOTE is not a separate SoT and not a separate table.  
SOURCE_DOCUMENT=docs/architecture/p3-f3-ops-bff-sot-alias-lock.md  
SOURCE_STATUS=P3-F3_ACCEPTED  

Supporting Phase-2 alias lock:  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/08-adr-register.md  
SOURCE_SECTION=ADR-05 SoT Alias Lock — INTERNAL_NOTE_CREATED → CASE_NOTE_RECORDED  

INTERNAL_NOTE_SEPARATE_SOT=NO

## C. CONTACT_ATTEMPT

| Layer | Value |
|---|---|
| API/BFF alias | `CONTACT_ATTEMPT` |
| Canonical resource type | `COMMUNICATION_EVENT` |
| Canonical persistence | `communication_events` (`OUTBOUND_CONTACT_ATTEMPT`) |

RULE=CONTACT_ATTEMPT is not a separate SoT and not a separate table.  
SOURCE_DOCUMENT=docs/architecture/p3-f3-ops-bff-sot-alias-lock.md  
SOURCE_STATUS=P3-F3_ACCEPTED  

Supporting Phase-2 alias lock:  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/08-adr-register.md  
SOURCE_SECTION=ADR-05 — CONTACT_ATTEMPT → OUTBOUND_CONTACT_ATTEMPT or reject  

CONTACT_ATTEMPT_SEPARATE_SOT=NO

## D. SoT Alias Lock

BINDING rules (accepted Phase-2 ADR-05 + Phase-3 F3 docs):

1. Alias handling only at the controlled BFF boundary.  
2. Persistence only against the canonical resource/table.  
3. Responses and idempotency use canonical SoT IDs.  
4. Dual-write forbidden.  
5. Alias tables forbidden.  
6. Unknown or conflicting aliases are rejected.

DUAL_WRITE_ALLOWED=NO  
ALIAS_TABLES_ALLOWED=NO  

SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/08-adr-register.md (ADR-05 SoT Alias Lock)  
SOURCE_DOCUMENT=docs/architecture/p3-f3-ops-bff-sot-alias-lock.md  

## E. Audit boundary

CLAIM=`ops_audit_events` is separate from intake `audit_events`; migration intentionally does not alter intake audit.  
SOURCE_DOCUMENT=docs/architecture/p3-f2a-first-slice-data-model.md  
SOURCE_SECTION=ops_audit_events notes  
SOURCE_STATUS=P3-F2A_ACCEPTED  

CLAIM=Promoted migration note: does NOT alter `public.audit_events` (intake lead/career audit).  
SOURCE_DOCUMENT=supabase/migrations/010_ops_audit_events.sql (header NOTE; schema baseline, not modified by P3-F7)  
SOURCE_STATUS=P3-F2B_BASELINE  

OPS_AUDIT_EQUALS_INTAKE_AUDIT=NO

## F. Automation / outbox ownership

CLAIM=Transactional outbox is the technical foundation for pending domain events; activation remains NO.  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/08-adr-register.md (ADR-06)  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_2  

CLAIM=P3-F3 is the canonical transactional outbox writer (atomic with limited writes).  
SOURCE_DOCUMENT=docs/architecture/p3-f3-ops-bff-sot-alias-lock.md  
SOURCE_STATUS=P3-F3_ACCEPTED  

CLAIM=P3-F5 is consumer / one-shot local worker stub only; not a second writer.  
SOURCE_DOCUMENT=docs/architecture/p3-f5-worker-stub.md  
SOURCE_STATUS=P3-F5_ACCEPTED  

P3_F5_IS_CANONICAL_OUTBOX_WRITER=NO  
AUTOMATION_ACTIVATION_DEFAULT=NO  

## DESIGN_READY lexicon note (J-F-05 remainder)

CLAIM=`DESIGN_READY_INVENTORY_ONLY` ≠ `IMPLEMENTATION_READY` ≠ activation authorization.  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/13-events-automation-architecture.md  
SOURCE_SECTION=LEXICON_LOCK  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_2  

## Closure

J_F05_STATUS=CLOSED_WITH_EVIDENCE  
FIRST_RESPONSE_EQUALS_CONTACT_ATTEMPT=NO  
INTERNAL_NOTE_SEPARATE_SOT=NO  
CONTACT_ATTEMPT_SEPARATE_SOT=NO  
DUAL_WRITE_ALLOWED=NO  
ALIAS_TABLES_ALLOWED=NO  
OPS_AUDIT_EQUALS_INTAKE_AUDIT=NO  
P3_F5_IS_CANONICAL_OUTBOX_WRITER=NO  
AUTOMATION_ACTIVATION_DEFAULT=NO  
