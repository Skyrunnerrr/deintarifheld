# M11N Hosted Operator Session Security Foundation

## Result

```text
M11N_RESULT=CLOSED_E2_LOCAL_HOSTED_AUTH_CONFIGURATION_PENDING
SERVER_SESSION_VERIFICATION=PROVEN_E2_LOCAL
SUPABASE_AUTH_INTEGRATION=PROVEN_E2_LOCAL
AAL2_ENFORCEMENT=PROVEN_E2_LOCAL
TOTP_MFA_FLOW=HOSTED_CONFIG_PENDING
INVITE_ONLY_OPERATOR_ACCESS=HOSTED_CONFIG_PENDING
TEST_HOSTED_IDENTITY_SEPARATION=PROVEN_E2_LOCAL
AUTH_TOKEN_HANDLING=PROVEN_E2_LOCAL
HOSTED_AUTH_CONFIGURATION=NOT_YET_PROVEN
HOSTED_REQUEST_AUTHZ=NOT_YET_PROVEN_E4
```

## Question answered

How does a real hosted Command Center request prove that it belongs to an authenticated, MFA-satisfied Supabase user and safely enter the existing M11H → M11I → M11J authorization chain?

## OD-A11-SESSION-POLICY

```text
STATUS=APPROVED_FOR_M11N_IMPLEMENTATION
```

Recorded in `OPERATOR_SESSION_POLICY_V1` (`packages/shared/src/operator-session-policy.js`):

| Property | Value | Evidence class |
|----------|-------|----------------|
| Provider | SUPABASE_AUTH | CODE_PROVEN (freeze) |
| MFA | TOTP_REQUIRED | CODE_PROVEN / HOSTED_CONFIG_REQUIRED |
| Min AAL | aal2 | PROVEN_E2_LOCAL (gate) |
| Inactivity | 30 minutes | PROVEN_E2_LOCAL (H0a reuse) |
| Max lifetime | 12 hours | PROVEN_E2_LOCAL (H0a reuse) |
| Single session | preferred if provider supports | NOT_PROVEN / HOSTED_CONFIG_REQUIRED |
| Refresh rotation | provider-supported | HOSTED_CONFIG_REQUIRED |
| JWT expiry | dashboard setting | HOSTED_CONFIG_REQUIRED |
| Cookie HttpOnly/Secure | architecture target | HOSTED_CONFIG_REQUIRED (CC host wiring) |
| localStorage authority | NONE | PROVEN_E2_LOCAL (policy + hosted gate) |
| TEST_* in hosted | DENY | PROVEN_E2_LOCAL |

## Implementation

| Module | Role |
|--------|------|
| `packages/shared/src/operator-session-policy.js` | Policy constants + auth mode |
| `packages/ops-api/src/auth/hosted-session.js` | Server verify + AAL2 + M11H resolve |
| `packages/ops-api/src/bff/auth-gate.js` | Hosted denies TEST_* / local gates |
| `packages/ops-api/src/bff/create-ops-bff.js` | Hosted A11 identity path via injectable provider |

Pipeline (hosted):

```text
Bearer access token (server-extracted)
→ getUser(jwt) provider adapter
→ getAuthenticatorAssuranceLevel → must be aal2
→ auth.users.id
→ M11H resolveOperatorByVerifiedAuthSubject
→ identity for M11J (unchanged)
```

Client body `authUserId` / `aal` / `user_metadata.role` are never authority.

## Auth audit (pre-M11N)

- Operational CC path was unsigned `DTH-Local` + `localStorage` (local TEST only)
- No `@supabase/ssr` / cookie session for CC yet
- Clerk passkey gate remains diagnostic-only
- Lead intake still uses `service_role` (out of M11N scope)

## Open risks (unchanged)

```text
M11-OPEN-DB-CONTEXT-FORGERY=OPEN
M11-OPEN-RUNTIME-DATABASE-IDENTITY-ALIGNMENT=OPEN
SERVICE_ROLE_RETIREMENT=NOT_YET_COMPLETE
```

M11N does **not** close these.

## Hosted configuration register (Owner / Dashboard)

| Setting | Status |
|---------|--------|
| Disable public signup | HOSTED_CONFIG_REQUIRED |
| Email/password enabled | HOSTED_CONFIG_REQUIRED |
| TOTP MFA enforced | HOSTED_CONFIG_REQUIRED |
| Session / JWT timing | HOSTED_CONFIG_REQUIRED |
| Refresh token rotation | HOSTED_CONFIG_REQUIRED |
| Redirect allowlist / Site URL | HOSTED_CONFIG_REQUIRED |
| Single-session if available | HOSTED_CONFIG_REQUIRED / NOT_SUPPORTED TBD |

## Local proof

`npm run test:dth:m11n` → **19/19 PASS**

## Next gate

Canonical matrix: **M11O** already E2-local; next security gate after M11N hosted foundation is **M11_SECURITY_GATE:M11P** (staging AuthZ→Ops), after Owner applies hosted Auth configuration.
