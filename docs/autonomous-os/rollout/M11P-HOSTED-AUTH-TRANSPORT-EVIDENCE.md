# M11P Hosted Auth Transport — Implementation Evidence

**Date:** 2026-08-26  
**Branch:** `rollout/dth-a14-autonomy-rollout-001`  
**Base:** `64dc00ad369fbb28b61e12775d5e22fb317a615a`  
**Staging project:** `uunpbmfvbfkideylhtbl`  
**Production:** `ylvczlldcgaxyadlawtb` — **not touched**

## Scope closed

Hosted Command Center **auth transport only** — not M11P E4, not staging deploy, not synthetic operator.

| Deliverable | Status |
|-------------|--------|
| Official `@supabase/ssr` cookie session | IMPLEMENTED |
| Hosted login (email/password, no signup) | IMPLEMENTED |
| TOTP enroll/challenge (AAL2) | IMPLEMENTED |
| Auth callback `/auth/callback` | IMPLEMENTED |
| Existing CC reuse via `/command-center` | IMPLEMENTED |
| M11N server verification chain | REUSED |
| Ops BFF hosted proxy | IMPLEMENTED (503 without `dth_ops_api` pool) |

## CC reuse

| Component | Class |
|-----------|-------|
| `packages/cc/src/ui/render.js` shell + views | REUSE_WITH_HOSTED_ADAPTER |
| `renderHostedShell` | ADAPT (hosted badge, cookie client path) |
| `cc-hosted-client.js` | ADAPT (credentials include, no localStorage) |
| Local CC server | LOCAL_ONLY_KEEP unchanged |

**Hosted route:** `/command-center`  
**Rebuild count:** 0

## Vercel env matrix (names only)

| NAME | BROWSER_SAFE | SERVER_ONLY | REQUIRED |
|------|--------------|-------------|----------|
| `DTH_AUTH_MODE=hosted` | NO | YES | RUNTIME |
| `NEXT_PUBLIC_SUPABASE_URL` | YES | — | RUNTIME |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | — | RUNTIME |
| `DTH_STAGING_OPS_DATABASE_URL` | NO | YES | E4 only |

## Supabase AUTH-05 callback

**Required redirect allowlist entry:**

```text
https://deintarifheld-staging.vercel.app/auth/callback
```

Site URL remains: `https://deintarifheld-staging.vercel.app`

## Regression (post-implementation)

| Suite | Result |
|-------|--------|
| M11P hosted auth | 23/23 PASS |
| M11N | 19/19 PASS |
| M11F–M11M | PASS |
| Kill/M11O | PASS |
| A13–A11, A10–A1 | PASS (A2/A3 batch flake; isolated 2× PASS) |
| DB, Shared, Boundary, Ops, CC | PASS |
| Lint, Build | PASS |

## Critical invariants

```text
PUBLIC_SIGNUP_UI_PRESENT=0
HOSTED_LOCALSTORAGE_AUTHORITY=0
TEST_IDENTITY_HOSTED_AUTH_BYPASSES=0
AAL1_PROTECTED_CC_SUCCESSES=0
SERVICE_ROLE_REQUIRED_FOR_HOSTED_LOGIN=NO
PRODUCTION_SUPABASE_REFS_IN_STAGING_RUNTIME=0 (code guard)
```

## Open blockers (unchanged)

```text
M11-OPEN-DB-CONTEXT-FORGERY=OPEN
M11-OPEN-RUNTIME-DATABASE-IDENTITY-ALIGNMENT=OPEN
SERVICE_ROLE_RETIREMENT=NOT_YET_COMPLETE
SYNTHETIC_OPERATOR_READY=NO
STAGING_OPS_RUNTIME_IDENTITY=NOT_PROVEN
M11P_READY_FOR_E4_EXECUTION=NO
```

## Next gate

1. Owner: Vercel staging env + Supabase callback allowlist  
2. Push + deploy (explicit `DEPLOY_M11P_HOSTED_AUTH_STAGING=YES`)  
3. Synthetic operator + M11H/I provisioning  
4. `DTH_STAGING_OPS_DATABASE_URL` as `dth_ops_api`  
5. M11P E4 (explicit `EXECUTE_M11P_E4=YES`)
