# DTH-M6 / M6-R1 Evidence Report (Redacted)

STATUS=OPEN  
TRANCHE=DTH-M6-R1  
AS_OF_UTC=2026-08-12T15:12:25Z  
OVERRIDE_DTH_M6_FREEZE=NO  
CLERK_CLI_SETUP=REJECTED  
COMMITTED=NO  
GOVERNANCE_COMMIT_BASE=5e6950698111cf1837c77d0882e35d6fa83e2731

## Classification legend

OBSERVED / INFERRED / UNKNOWN / NOT_IMPLEMENTED / UNAVAILABLE_DUE_TO_RETENTION / UNPROVEN

## Gate correction

OTHER_USERS_UNCHANGED → NO_UNINTENDED_USER_MUTATION_IN_CLEANUP_WINDOW (documented only; no retroactive evidence).

## Evidence architecture

| Tier | Path | Git |
|---|---|---|
| A Redacted | `docs/autonomous-os/evidence-reports/` | after review |
| B Raw | `~/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/` | never |
| Forbidden | `/tmp` as canonical | — |

## Live Dashboard / Logs readback

### Identity gates

| Item | Result | Class |
|---|---|---|
| CLERK_APP_IDENTITY | UNPROVEN | UNKNOWN — app ID hint alone insufficient; Dashboard badge/name not agent-observed |
| CLERK_ENVIRONMENT | UNPROVEN | UNKNOWN — Development badge not agent-observed this tranche |
| FAPI host hint | sterling-husky-22.clerk.accounts.dev | OBSERVED (E2 host-only) — not accepted as sole environment proof per Owner rule |

### Required checks

| Check | Result |
|---|---|
| Users search H0b3 test user | NOT_EXECUTED → USER_DELETE_READBACK=UNPROVEN; TEST_USER_COUNT=UNPROVEN |
| Application Logs user.deleted | NOT_EXECUTED → TARGET_USER_DELETE_EVENT=UNPROVEN |
| Passkey lifecycle logs | NOT_EXECUTED → PASSKEY_ABSENCE_VERIFIED=UNPROVEN |
| Invitations state | NOT_EXECUTED → INVITATION_STATE=UNPROVEN |
| Cleanup-window mutation review | NOT_EXECUTED → NO_UNINTENDED_USER_MUTATION_IN_CLEANUP_WINDOW=UNPROVEN |
| Log retention covers cleanup window | UNKNOWN (plan tier unknown; cleanup ~2026-08-03; now 2026-08-12 ≈9d) |

OBSERVED: Agent has no authenticated Clerk Dashboard session and no browser automation to inspect Users/Logs/Invitations.  
OBSERVED: Owner rejected Clerk CLI setup and freeze override.  
OBSERVED: Dashboard app URL opened for Owner: `https://dashboard.clerk.com/apps/app_3HOQfA1CrKrVoMiS0szyaMzlyNO`  
NOT_IMPLEMENTED: Automated Dashboard screenshot/OCR capture in this environment.  
INFERRED: Live E3/E4 provider proof requires Owner-interactive Dashboard observation (or later authorized M6-R2 API — not executed).

## Process controls still PASS

| Gate | Result |
|---|---|
| NO_CONFIG_CHANGE | PASS |
| NO_PRODUCTION_IMPACT | PASS |
| NO_SECRET_EXPOSURE | PASS |
| CLERK_INIT / SDK scaffold | NOT_DONE (correct) |

## Evidence gaps

```text
EVIDENCE_GAP=Authenticated Development Dashboard Users/Logs/Invitations readback not completed by agent
CAUSE=No agent Dashboard session / no browser automation; app ID alone forbidden as identity proof
RESIDUAL_RISK=MEDIUM
ACCEPTED_HISTORICAL_EVIDENCE_GAP=NOT_GRANTED_BY_CURSOR
LOG_RETENTION_COVERS_CLEANUP_WINDOW=UNKNOWN
```

## Revised M6 gate table

| Gate | Result |
|---|---|
| USER_DELETE_READBACK | UNPROVEN |
| TEST_USER_COUNT | UNPROVEN |
| TARGET_USER_DELETE_EVENT | UNPROVEN |
| PASSKEY_ABSENCE_VERIFIED | UNPROVEN |
| INVITATION_STATE | UNPROVEN |
| NO_UNINTENDED_USER_MUTATION_IN_CLEANUP_WINDOW | UNPROVEN |
| NO_CONFIG_CHANGE | PASS |
| NO_PRODUCTION_IMPACT | PASS |
| NO_SECRET_EXPOSURE | PASS |
| PERSISTENT_EVIDENCE | PARTIAL |
| CLERK_APP_IDENTITY | UNPROVEN |
| CLERK_ENVIRONMENT | UNPROVEN |

## Decision

```text
M6_R1_STATUS=STOPPED_SAFE
M6_STATUS=OPEN
M6-R2=NOT_EXECUTED
M7=NOT_STARTED
CLERK_CLI=REJECTED
```

## Raw SHA256

| File | SHA256 |
|---|---|
| 00-prior-m6-readback.txt | 73397272c993b70ad07b2004143583e3eeb660987b0d74691aa68f56fed9ac12 |
| 01-prior-m6-gate.txt | 769baabf10164fe83107e588eb9e130acf87011d6527a58b12aca4f847b46caf |
| 02-m6r1-attempt.txt | 4bff9a803f6da3729306f27e7f9e5eec89d2fa59b0d72fc59ce817da97fea3fd |
| 03-gate-correction.txt | f9d9454443ecabc9fff3dbf3f76a85f5f0d166c566618579cd8ef6d317ca335a |
| 04-owner-no-cli-override.txt | 8a48a4a74d6268f34d8ac4aba9bfa055ae0af767c4497b393022bc9f2ab5e8d5 |
| 05-sha256-index.txt | 43173f3acd242a41de6de10bd1fd130a8aa9837b1a1bc4d410425023dfe23a76 |
