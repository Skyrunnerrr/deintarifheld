# M11P Invite Acceptance + Initial Password Setup — Defect Closure

**Date:** 2026-08-26  
**Branch:** `rollout/dth-a14-autonomy-rollout-001`  
**Prior SHA:** `fcc124be145c6cc8deed2a2f593eac399a519a28`  
**Staging:** `https://deintarifheld-staging.vercel.app`

## Observed defect

```text
HOSTED_INVITE_ACCEPTANCE_FLOW=INCOMPLETE
INITIAL_PASSWORD_SETUP=MISSING
```

Invited synthetic staging user: invite email → Supabase session established → redirected directly to `/command-center/mfa/` without ever setting an initial password.

## Root cause

`/auth/callback` performed `exchangeCodeForSession(code)` then defaulted to `/command-center/`. Middleware sent AAL1 users to MFA. **No invite/recovery type handling** and **no set-password route** existed.

## Fix

| Component | Change |
|-----------|--------|
| `lib/command-center/invite-flow.js` | Flow classification, safe redirects, httpOnly cookie contract |
| `app/auth/callback/route.js` | Detect `type=invite|recovery` (+ server `invited_at` at callback); set flow cookie; redirect set-password |
| `app/command-center/set-password/**` | Minimal password + confirm UI; `updateUser({ password })` |
| `app/api/command-center/auth/flow-state` | Session + pending-password state |
| `app/api/command-center/auth/complete-password-setup` | Mark password complete (cookie), clear flow cookie |
| `middleware.js` | Block MFA/CC until password setup complete for pending invite/recovery |
| `MfaClient.jsx` | Defense-in-depth redirect to set-password |

### Target first-time flow

```text
Invite link → callback session → /command-center/set-password → updateUser(password)
→ /command-center/mfa → TOTP → AAL2 → M11H/I gate → Command Center
```

### Existing login unchanged

```text
/command-center/login → signInWithPassword → MFA → AAL2
```

No invite flow cookie → set-password skipped.

## Security invariants

```text
PASSWORD_STORAGE_DTH=NO
INVITE_OPEN_REDIRECT_SUCCESSES=0
INVITED_USER_MFA_BEFORE_PASSWORD_SETUP_SUCCESSES=0
AAL2_UNPROVISIONED_OPERATOR_ACCESS_SUCCESSES=0
TEST_IDENTITY_HOSTED_AUTH_BYPASSES=0
```

## Tests

`npm run test:dth:m11p-hosted-invite` — INVITE-01 … INVITE-16

## Hosted readback (post-deploy)

Fresh disposable user:

```text
INVITE_LINK=PASS
PASSWORD_SETUP_VISIBLE=YES
PASSWORD_SET=PASS
MFA_PAGE_AFTER_PASSWORD=YES
QR_VISIBLE=YES
TOTP_VERIFY=PASS
FINAL_AAL=aal2
M11H_MAPPING=absent unless provisioned separately
```

## Open blockers

```text
M11P_READY_FOR_E4_EXECUTION=NO
M11H/I synthetic operator provisioning=NOT_READY
```
