# M11P Hosted Auth Execution Evidence

**Date:** 2026-08-26  
**Target project:** `uunpbmfvbfkideylhtbl` (`deintarifheld-staging`)  
**Production:** `ylvczlldcgaxyadlawtb` — **not touched**

## Config access mechanism audit

| Mechanism | Available | Result |
|-----------|-----------|--------|
| Supabase CLI (logged in) | YES | Projects list, migration list/push for staging ref |
| Supabase Management API auth config read | NO | `401` — access token not usable for `/config/auth` from agent environment |
| Supabase Dashboard | OWNER | Required for Auth settings |
| Repository automation for Auth | NO | None found |

```text
HOSTED_AUTH_PREREQUISITES=NOT_PROVEN
PRODUCTION_AUTH_CONFIG_MUTATIONS=0
```

## Session control classification

| Control | Classification | Notes |
|---------|----------------|-------|
| Public signup OFF | OWNER_CONFIGURATION | Dashboard |
| Email/password ON | OWNER_CONFIGURATION | Dashboard |
| TOTP MFA | SUPABASE_NATIVE + OWNER_CONFIGURATION | Enroll/verify in Dashboard |
| AAL2 enforcement | COMBINED | Supabase JWT `aal` + DTH server (`hosted-session.js`) |
| JWT expiry | SUPABASE_NATIVE | Dashboard Auth → Settings |
| 12h total session | PLAN_DEPENDENT | Refresh token lifetime — Dashboard |
| 30m inactivity | DTH_SERVER_ENFORCED | H0a constants; not native Supabase idle timeout |
| Refresh rotation | SUPABASE_NATIVE | Dashboard default |
| Single session | NOT_SUPPORTED reliably | Document NOT_PROVEN |
| Site URL / redirects | OWNER_CONFIGURATION | Dashboard URL Configuration |

## Owner action execution contract

### AUTH-01 — Disable public signup

| Field | Value |
|-------|-------|
| CURRENT_STATE | HOSTED_NOT_PROVEN |
| TARGET_STATE | Signup disabled / invite-only |
| EXACT_UI_LOCATION | Dashboard → Project `deintarifheld-staging` → **Authentication** → **Providers** → **Email** |
| EXACT_ACTION | Disable **Enable sign ups** (or global **Allow new users to sign up** = OFF under Authentication settings) |
| SAVE_REQUIRED | YES |
| VERIFICATION_METHOD | Attempt `/auth/v1/signup` with anon key → reject; no new auth.users without invite |
| ROLLBACK | Re-enable signups (not recommended) |
| BLOCKS_M11P | YES |

### AUTH-02 — Enable email/password (invited users)

| Field | Value |
|-------|-------|
| EXACT_UI_LOCATION | Authentication → **Providers** → **Email** |
| EXACT_ACTION | Enable Email provider; keep signups disabled |
| VERIFICATION_METHOD | Invited user password login succeeds |
| BLOCKS_M11P | YES |

### AUTH-03 — Enable TOTP MFA

| Field | Value |
|-------|-------|
| EXACT_UI_LOCATION | Authentication → **Multi-Factor Authentication (MFA)** → **Authenticator app (TOTP)** |
| EXACT_ACTION | **Enroll** = enabled; **Verify** = enabled; **Phone/SMS MFA** = disabled |
| VERIFICATION_METHOD | `auth.mfa.listFactors()` shows verified TOTP factor after enroll |
| BLOCKS_M11P | YES |

### AUTH-04 — Limit AAL1 sessions

| Field | Value |
|-------|-------|
| EXACT_UI_LOCATION | Authentication → MFA → **Security** (or MFA settings panel) |
| EXACT_ACTION | **Limit duration of AAL1 sessions** = ON (`MFA_ALLOW_LOW_AAL` = false) |
| VERIFICATION_METHOD | AAL1 session cannot persist for protected Ops path; DTH denies AAL1 regardless |
| BLOCKS_M11P | YES |

### AUTH-05 — JWT and refresh

| Field | Value |
|-------|-------|
| EXACT_UI_LOCATION | Authentication → **Settings** (Session / JWT) |
| EXACT_ACTION | JWT expiry ≤ 3600s; refresh token rotation ON; refresh lifetime aligned to ≤12h policy |
| VERIFICATION_METHOD | Decode JWT `exp`; refresh works; expired access denied |
| BLOCKS_M11P | YES |

### AUTH-06 — Site URL and redirect allowlist

| Field | Value |
|-------|-------|
| EXACT_UI_LOCATION | Authentication → **URL Configuration** |
| EXACT_ACTION | **Site URL** = staging CC HTTPS origin (when deployed); **Redirect URLs** = explicit callback paths only (no wildcards) |
| VERIFICATION_METHOD | Malicious external `returnTo` rejected |
| BLOCKS_M11P | YES |

### AUTH-07 — Synthetic staging operator

| Field | Value |
|-------|-------|
| EXACT_UI_LOCATION | Authentication → **Users** → Invite user |
| EXACT_ACTION | Invite `dth.staging.operator@<approved-test-domain>`; user completes password + TOTP enroll |
| VERIFICATION_METHOD | AAL2 session; map in `security.operators` + M11I role on staging DB |
| BLOCKS_M11P | YES (for E4) |

## MFA hosted proof

```text
AAL2_HOSTED_PROOF=NOT_PROVEN
MFA_HOSTED_PROOF=NOT_PROVEN
```

Blocked until AUTH-01 through AUTH-07 complete and readback performed.

## Invite-only invariant

```text
PUBLIC_AUTH_USER_AUTO_OPERATOR_SUCCESSES=0 (required; not yet hosted-proven)
```

M11H mapping remains mandatory regardless of Supabase signup setting.

## CC session transport (Workstream B)

| Item | Status |
|------|--------|
| `@supabase/ssr` | NOT installed |
| Current CC | `DTH-Local` + localStorage (LOCAL_TEST only) |
| Ops hosted verify | M11N bearer path E2 proven |
| Cookie SSR wiring | **DEFERRED** until AUTH-06 Site URL known + package install authorized |

```text
COMMAND_CENTER_HOSTED_SESSION_TRANSPORT=NOT_READY
LOCAL_STORAGE_OPERATOR_AUTHORITY=0 in hosted mode policy (localStorage not authority when DTH_AUTH_MODE=hosted)
```

## Result

```text
OWNER_CONFIGURATION_BLOCKERS=7
NEXT_ACTION=OWNER_CONFIGURATION_REQUIRED:AUTH-01
```
