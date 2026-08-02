# P3-F3 — Ops BFF with SoT Alias Lock

TRANCHE=P3-F3  
LOCAL_DEV_ONLY=YES  
CC_UI=NO  
MIGRATIONS=NO  
STRONG_AUTHZ_COMPLETE=NO  
PRODUCTION_AUTHZ_READY=NO  
PRODUCTION_IDP_READY=NO  

## Namespace

`INTERNAL_BFF_PREFIX=/ops/v1`  
No public intake route registration.

## AuthZ mode (local)

`CURRENT_LOCAL_AUTHZ_MODE=SYNTHETIC_OWNER_ONLY_DEV_GATE`  
Person CC session required; shared-secret / service / break-glass rejected.

## SoT Alias Lock (J-F-01 / J-F-05 partial)

| API alias | Canonical resource | Persistence |
|---|---|---|
| `INTERNAL_NOTE` | `CASE_NOTE` | `case_notes` (`CASE_NOTE_RECORDED`) |
| `CONTACT_ATTEMPT` | `COMMUNICATION_EVENT` | `communication_events` (`OUTBOUND_CONTACT_ATTEMPT`) |

`FIRST_RESPONSE` is a milestone only — not an alias for contact attempts and not a stored comms entity.

Rules: remap-or-reject; no alias tables; no dual-write; responses return canonical ids only.

## Limited writes

INTERNAL_NOTE_CREATE · CONTACT_ATTEMPT_RECORD · TASK_CREATE · TASK_STATUS_UPDATE · ASSIGNMENT_SET · CASE_STATUS_APPEND · APPROVAL_REQUEST_CREATE · APPROVAL_DECISION_OWNER_ONLY · KILL_STATE_CHANGE_OWNER_ONLY  

Not authorized: CASE_CREATE · deletes · bulk · public intake · CC UI · workers · automation.

## Kill integration

F6 in-memory foundation. `COMMAND_CENTER_WRITE_ACTIONS=ACTIVE` → limited writes return 423; kill control remains Owner-reachable. `KILL_STATE_PERSISTED=NO`.
