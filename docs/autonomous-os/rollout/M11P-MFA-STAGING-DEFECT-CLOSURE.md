# M11P Hosted TOTP Enrollment / Recovery — Staging Defect Closure

**Date:** 2026-08-26  
**Branch:** `rollout/dth-a14-autonomy-rollout-001`  
**Prior deployed SHA:** `5d36bed6a3b33dea634498edcfd83b57156c199d`  
**Staging:** `https://deintarifheld-staging.vercel.app`  
**Staging Supabase:** `uunpbmfvbfkideylhtbl`  
**Production:** not touched

## Observed defect

```text
HOSTED_TOTP_ENROLLMENT_RECOVERY=BROKEN_IN_REAL_STAGING
```

Synthetic staging operator: password login succeeded, redirect to `/command-center/mfa/`, UI showed **only** “Authenticator-Code eingeben” (6-digit field). **No QR code** was ever visible. Supabase Dashboard MFA factor removal + re-login did not recover enrollment UX.

Classification: **staging blocker** — not operator error.

## Root cause

| Issue | Detail |
|-------|--------|
| **QR_RENDERING_BUG** | `dangerouslySetInnerHTML` assumed `enroll().totp.qr_code` is raw SVG HTML. Supabase returns a **data-URL image** (`data:image/svg+xml;base64,...`) intended for `<img src={...}>`. QR rendered blank/invisible while verify UI could still appear if a verified factor existed. |
| **STALE_FACTOR_HANDLING_BUG** | Binary `listFactors → verified? challenge : enroll` ignored **unverified** interrupted enrollments and **lost-authenticator** recovery. User with verified factor but no app access had no safe path; user with stale unverified factor could not restart without manual Dashboard cleanup. |

## Fix

Explicit MFA state machine (`lib/command-center/mfa-flow.js`):

```text
LOADING → NO_FACTOR | UNVERIFIED_FACTOR | VERIFIED_FACTOR | AAL2 | RECOVERY_REQUIRED | ERROR
```

| State | Behavior |
|-------|----------|
| `NO_FACTOR` | `mfa.enroll({ factorType: 'totp', friendlyName: 'DTH Staging TOTP' })` → QR via `<img src>` + optional manual secret (session-only, never persisted) |
| `UNVERIFIED_FACTOR` | Explicit restart: `unenroll` stale unverified factor(s), then re-enroll (no factor storm — `initStarted` guard) |
| `VERIFIED_FACTOR` | `challenge` → verify code → AAL2 redirect |
| `RECOVERY_REQUIRED` | Admin-assisted recovery instructions; **no auto-unenroll** of verified factors |
| Diagnostics | Safe fields only: `CURRENT_AAL`, `NEXT_AAL`, factor counts — never secret/QR/JWT |

QR helper: `lib/command-center/totp-qr.js` — `resolveTotpQrPresentation()`; **no** `dangerouslySetInnerHTML`.

UI: `app/command-center/mfa/MfaClient.jsx` (client component); `page.jsx` thin wrapper.

## Tests (local)

| ID | Case | Result |
|----|------|--------|
| MFA-01 | No factors → enrollment | PASS |
| MFA-02 | Enrollment QR data-URL | PASS |
| MFA-03 | QR rendered as `<img src>` | PASS |
| MFA-04 | No dangerous innerHTML | PASS |
| MFA-05 | Unverified factor explicit | PASS |
| MFA-06 | Verified → challenge | PASS |
| MFA-07 | Challenge success → AAL2 | PASS |
| MFA-08 | Invalid code deny | PASS |
| MFA-09 | No factor storm on interrupt | PASS |
| MFA-10 | Admin reset → enrollment | PASS |
| MFA-11 | Lost authenticator no auto-disable | PASS |
| MFA-12–16 | Secret/QR never logged/persisted; AAL1 block; TEST bypass zero | PASS |

Suite: `npm run test:dth:m11p-hosted-mfa` — **16/16 PASS**

## Regression (hotfix scope)

| Suite | Result |
|-------|--------|
| M11P hosted MFA | 16/16 PASS |
| M11P hosted auth | 23/23 PASS |
| M11N, M11F–M11M | PASS |
| Kill/M11O, DB, Shared, Boundary, Ops, CC | PASS |
| A13–A4 | PASS |
| A3/A2 batch | Pre-existing flake when run after full DB suite (isolated re-run PASS per prior M11P evidence) |
| Lint, Build | PASS |

## Hosted readback (post-deploy — Owner/synthetic operator)

Required proof with **fresh disposable staging user** (zero MFA factors):

```text
PASSWORD_LOGIN=PASS
INITIAL_AAL=aal1
ZERO_VERIFIED_FACTORS=YES
QR_VISIBLE=YES
TOTP_ENROLLMENT=PASS
TOTP_VERIFY=PASS
FINAL_AAL=aal2
```

Before TOTP: `AAL1_PROTECTED_CC_SUCCESSES=0`  
After TOTP: `AAL2_HOSTED_PROOF=PASS`  
If M11H mapping absent after AAL2: `AUTHENTICATED_AAL2_BUT_NOT_PROVISIONED` → DENY (expected).

## Open blockers (unchanged)

```text
M11P_READY_FOR_E4_EXECUTION=NO
M11H/I synthetic operator provisioning=NOT_READY
DTH_STAGING_OPS_DATABASE_URL=NOT_SET
```

## Next action

1. Deploy hotfix to `deintarifheld-staging` only  
2. Create fresh synthetic staging user; single clean MFA enrollment pass  
3. Do **not** start M11P E4 until MFA hosted readback + M11H/I prerequisites green
