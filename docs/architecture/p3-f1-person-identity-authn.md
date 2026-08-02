# P3-F1 — Person Identity AuthN Foundation

TRANCHE=P3-F1
LOCAL_DEV_ONLY=YES
PRODUCTION_IDP_CHANGE_AUTHORIZED=NO
STRONG_AUTHZ_COMPLETE=NO
PRODUCTION_IDENTITY_READY=NO

## Principals

- `PERSON_PRINCIPAL` — only type allowed for Command-Center sessions
- `SERVICE_PRINCIPAL` — technical; `CC_SESSION_ALLOWED=NO`
- `BREAK_GLASS_PRINCIPAL` — secret-admin technical; `CC_SESSION_ALLOWED=NO` (J-F-02)

## Local Owner path

- Synthetic person id: `person_synth_owner_dth_local_001`
- Requires `DTH_LOCAL_AUTH_ENABLED=true` and non-production `NODE_ENV`
- Production mode: `PRODUCTION_MODE_LOCAL_AUTH=DENIED`

## Shared secret

Shared secrets cannot create person/CC sessions.

## Packages touched

`packages/shared`, `packages/ops-api`, `packages/cc` (contracts only — no UI)
