# A0 Business State Model

## CURRENT_STATE_MODEL (repository-proven)

### Production/staging apply root
- `public.leads.status`: `new | in_progress | done | spam | deleted`
- `public.career_applications.status`: same

### Ops drafts (LOCAL / DO_NOT_APPLY)
- cases/tasks: `open | in_progress | waiting | done | cancelled`
- outbox: `pending | processing | processed | failed | cancelled`
- approvals: `pending | approved | rejected | cancelled`
- communication_events.sot_event_type: outbound/inbound/internal ops enums only

## TARGET_B2B_STATE_MODEL (freeze — design only)

Canonical case lifecycle authority (single server-enforced machine):

```text
LEAD_ACCEPTED → TRIAGE_PENDING → QUALIFYING
  ↛ MISSING_INFORMATION → QUESTION_SENT → AWAITING_CUSTOMER → CUSTOMER_RESPONSE_RECEIVED → QUALIFYING
QUALIFYING → QUALIFIED → DOCUMENT_CHECK → CALL_OFFERED → CALL_BOOKED → OFFER_INPUT_READY
→ TARIFF_EVALUATION → OFFER_DRAFTED → (APPROVAL_REQUIRED|) → OFFER_READY → OFFER_SENT → FOLLOW_UP_ACTIVE
→ ACCEPTED | LOST | NURTURE
ACCEPTED → SWITCH_PREPARATION → SWITCH_SUBMITTED → SUPPLIER_PENDING → SWITCH_CONFIRMED → ACTIVE_CUSTOMER
→ RENEWAL_MONITORING → RENEWAL_DUE → TARIFF_EVALUATION
```

## MAPPING_CURRENT_TO_TARGET

| Current | Target |
|---------|--------|
| lead `new` | LEAD_ACCEPTED / TRIAGE_PENDING seed |
| lead `in_progress` | ambiguous — map via case state, not lead alone |
| draft case `open` | TRIAGE_PENDING / QUALIFYING |
| draft case `waiting` | AWAITING_CUSTOMER / SUPPLIER_PENDING |
| draft case `done` | terminal business states only with sub-reason |
| outbox `pending/processing/...` | keep as **execution** states, not case states |

Rules: one canonical case-state authority; LLM cannot invent status strings; transitions audited; external effects require durable intent + readback.
