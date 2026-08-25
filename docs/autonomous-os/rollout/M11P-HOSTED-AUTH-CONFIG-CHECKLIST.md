# M11P Hosted Supabase Auth Configuration Checklist

**Policy source:** `OPERATOR_SESSION_POLICY_V1` / OD-A11-SESSION-POLICY (approved M11N)  
**Hosted readback:** NOT performed in this mission (no authorized dashboard/API access in agent environment)  
**Target project:** Staging Auth for Command Center — `deintarifheld-staging` (`uunpbmfvbfkideylhtbl`) unless Owner designates separate CC Auth project

## Repository configuration audit (no secret values)

| Item | Repo state | Notes |
|------|------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | PLACEHOLDER in `.env.example` | Leads path only |
| `SUPABASE_SERVICE_ROLE_KEY` | PLACEHOLDER in `.env.example` | Server-only; leads intake |
| `SUPABASE_ANON_KEY` / publishable | **ABSENT** from `.env.example` | Required for CC hosted Auth |
| `DTH_AUTH_MODE` | CODE_ONLY (`hosted` / `local_test`) | `operator-session-policy.js` |
| `@supabase/ssr` | **ABSENT** from `package.json` | ADAPT_OFFICIAL when CC host wired |
| `@supabase/supabase-js` | PRESENT (`^2.111.0`) | Leads + future Auth adapter |
| CC session transport | LOCAL_ONLY (`DTH-Local` + localStorage) | `packages/cc/src/ui/cc-client.js` |
| Ops hosted verify | CODE_PROVEN E2 | `packages/ops-api/src/auth/hosted-session.js` |
| MFA/TOTP routes in CC | **ABSENT** | Minimal UI deferred to host wiring |
| Site URL / redirects | DOCUMENTED targets only | `h0a-constants.js`: `cc.deintarifheld.de`, localhost:3100 |
| Session policy constants | CODE_PROVEN | 12h max, 30m inactivity, AAL2, TOTP |

## Hosted configuration register

| SETTING | REPO EXPECTATION | HOSTED CURRENT STATE | TARGET | CAN VERIFY PROGRAMMATICALLY | OWNER ACTION | M11P BLOCKING |
|---------|------------------|----------------------|--------|----------------------------|--------------|---------------|
| Public signup | OFF | HOSTED_NOT_PROVEN | Disabled | Partial (signup API probe) | YES | YES |
| Email/password login | ON (operators) | HOSTED_NOT_PROVEN | Enabled | Partial | YES | YES |
| Magic link | OFF_V1 | HOSTED_NOT_PROVEN | Disabled | Partial | YES | YES |
| Social OAuth | OFF_V1 | HOSTED_NOT_PROVEN | All disabled | Partial | YES | NO |
| SMS MFA | OFF_V1 | HOSTED_NOT_PROVEN | Disabled | Partial | YES | NO |
| TOTP MFA | REQUIRED | HOSTED_NOT_PROVEN | Enroll + verify enabled | Partial (`listFactors`) | YES | YES |
| AAL2 for protected access | REQUIRED | HOSTED_NOT_PROVEN | `getAuthenticatorAssuranceLevel` = aal2 | YES (Auth API) | YES | YES |
| Limit AAL1 sessions (`MFA_ALLOW_LOW_AAL`) | Recommended ON | HOSTED_NOT_PROVEN | Limit duration of AAL1 sessions = ON | Dashboard only | YES | YES |
| JWT expiry (access) | Short-lived | HOSTED_NOT_PROVEN | ≤ 3600s conservative start | Dashboard / Management API | YES | YES |
| Total session (~12h) | 12h policy | PLAN_DEPENDENT | Refresh token lifetime aligned | Dashboard | YES | YES |
| Inactivity (30m) | 30m policy | NOT_SUPPORTED natively | App/server enforcement + short JWT | CUSTOM_DTH boundary | PARTIAL | YES |
| Refresh token rotation | Provider default | HOSTED_NOT_PROVEN | Enabled (Supabase default) | Dashboard | YES | YES |
| Refresh reuse detection | Provider | HOSTED_NOT_PROVEN | Enabled | Dashboard | YES | NO |
| Single session / max 1 | Preferred | NOT_SUPPORTED reliably | Document `NOT_PROVEN`; safest alternative | NO | PLAN_DEPENDENT | NO |
| Site URL | CC staging origin | HOSTED_NOT_PROVEN | Exact staging CC HTTPS origin | Dashboard | YES | YES |
| Redirect allowlist | Relative + allowlisted origins | HOSTED_NOT_PROVEN | Staging CC + auth callback paths only | Dashboard | YES | YES |
| Password policy | Strong | HOSTED_NOT_PROVEN | Provider-supported minimum length/complexity | Dashboard | YES | NO |
| Invite-only | REQUIRED | HOSTED_NOT_PROVEN | Manual invite / no public signup | Dashboard + M11H | YES | YES |
| Email confirmation | Invite flow | HOSTED_NOT_PROVEN | Per invite policy | Dashboard | YES | NO |

## Owner action checklist

### 1. Disable public operator signup

- **CURRENT:** HOSTED_NOT_PROVEN  
- **TARGET:** No self-service operator accounts  
- **WHY:** Invite-only operator model  
- **WHERE:** Supabase Dashboard → Authentication → Providers → Email → disable sign ups (or global “Allow new users to sign up” OFF)  
- **HOW_TO_SET:** Turn off public registration; use invite/admin create only  
- **HOW_TO_VERIFY:** Attempt signup via public API/UI → must fail; `PUBLIC_AUTH_USER_AUTO_OPERATOR_SUCCESSES=0`  
- **ROLLBACK:** Re-enable signup (not recommended)  
- **BLOCKS_M11P:** YES

### 2. Enable email/password (operators only)

- **CURRENT:** HOSTED_NOT_PROVEN  
- **TARGET:** Email/password enabled for invited users  
- **WHY:** PRIMARY_LOGIN=EMAIL_PASSWORD  
- **WHERE:** Authentication → Providers → Email  
- **HOW_TO_SET:** Enable email provider; keep signup disabled  
- **HOW_TO_VERIFY:** Invited user can sign in with password  
- **ROLLBACK:** Disable email provider  
- **BLOCKS_M11P:** YES

### 3. Enable TOTP MFA

- **CURRENT:** HOSTED_NOT_PROVEN  
- **TARGET:** TOTP enroll + verify enabled; SMS off  
- **WHY:** MFA=TOTP_REQUIRED  
- **WHERE:** Authentication → MFA → Authenticator app (TOTP)  
- **HOW_TO_SET:** Enroll enabled + verify enabled; disable phone/SMS MFA  
- **HOW_TO_VERIFY:** `supabase.auth.mfa.listFactors()` shows verified TOTP; challenge succeeds  
- **ROLLBACK:** Disable TOTP (blocks M11P)  
- **BLOCKS_M11P:** YES

### 4. Enforce AAL2 / limit AAL1

- **CURRENT:** HOSTED_NOT_PROVEN  
- **TARGET:** Password-only sessions cannot access protected Ops/CC surfaces  
- **WHY:** MINIMUM_ASSURANCE=AAL2  
- **WHERE:** Authentication → MFA → Security → “Limit duration of AAL1 sessions” ON  
- **HOW_TO_SET:** Enable AAL1 session limit; DTH server denies `aal1` at Ops BFF (already E2)  
- **HOW_TO_VERIFY:** Login without MFA challenge → Ops protected route DENY; after TOTP → ALLOW path to M11H  
- **ROLLBACK:** Allow low AAL  
- **BLOCKS_M11P:** YES

### 5. JWT / session timing

- **CURRENT:** HOSTED_NOT_PROVEN  
- **TARGET:** Short access JWT; refresh rotation on; total bounded session  
- **WHY:** No permanent operator browser session  
- **WHERE:** Authentication → Settings → JWT expiry; refresh token settings  
- **HOW_TO_SET:** Start JWT expiry 3600s; align refresh lifetime ≤ 12h policy; enable rotation  
- **HOW_TO_VERIFY:** Decode hosted JWT `exp`; refresh flow works; expired session denied  
- **ROLLBACK:** Restore prior Auth settings snapshot  
- **BLOCKS_M11P:** YES

### 6. Site URL + redirect allowlist

- **CURRENT:** HOSTED_NOT_PROVEN  
- **TARGET:** Staging CC origin only (+ localhost for dev if needed)  
- **WHY:** Prevent open redirect / token leakage  
- **WHERE:** Authentication → URL Configuration  
- **HOW_TO_SET:** Site URL = staging CC base; Additional Redirect URLs = explicit callback paths (no wildcards)  
- **HOW_TO_VERIFY:** Malicious `returnTo=https://evil` rejected; `isSafeAuthRedirectPath` + provider allowlist  
- **ROLLBACK:** Restore URL config  
- **BLOCKS_M11P:** YES

### 7. Synthetic staging operator invite

- **CURRENT:** ABSENT  
- **TARGET:** One staging-only operator with TOTP enrolled  
- **WHY:** M11P E4 positive path  
- **WHERE:** Dashboard invite + M11H SQL seed on staging DB  
- **HOW_TO_SET:** Create auth user → enroll TOTP → map in `security.operators` → assign M11I role  
- **HOW_TO_VERIFY:** Hosted session + AAL2 + M11H resolve ACTIVE  
- **ROLLBACK:** Disable operator + revoke auth user  
- **BLOCKS_M11P:** YES (for E4)

## CC session transport (not blocking dashboard-only prep)

| Item | State |
|------|-------|
| Current | `DTH-Local` token in localStorage (local E2 only) |
| Official reuse | `@supabase/ssr` cookie pattern (ADAPT_OFFICIAL) |
| Hosted readiness | NOT_READY — package not installed; CC not wired |
| M11P blocker? | YES for full HTTPS browser E4; server-side token probe can precede |

## Client secret scan (reproven)

```text
SERVICE_ROLE_KEYS_IN_CLIENT_BUNDLE=0
DATABASE_PASSWORDS_IN_CLIENT_BUNDLE=0
REFRESH_TOKENS_IN_LOGS=0 (sanitize in hosted-session.js)
ACCESS_TOKENS_IN_URLS=0
MFA_SECRETS_IN_DTH_STORAGE=0
```

## Phase B success criteria

```text
HOSTED_AUTH_PREREQUISITES=NOT_PROVEN
```

Unblock when all blocking settings = HOSTED_PROVEN via readback.
