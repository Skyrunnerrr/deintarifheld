# Current State — Observed

AS_OF_UTC=2026-08-12  
LOCAL_HEAD=955e849d3f9006910a989727d9f21608a2f682e6  
BRANCH=feat/deintarifheld-production-cutover-001  
WORKTREE=CLEAN

## Dual-plane reality (OBSERVED)

| Plane | Location | Evidence level | Notes |
|---|---|---|---|
| Public website | Checkdomain static | E5 (prior DTH-09D/09E) | Built from `fea1a54` / `origin/main` |
| Public lead API | Vercel `deintarifheld-leads-api` | E5 (prior DTH-09E) | Internal mail mode |
| Public lead DB | Supabase migrations `001`–`002` | E5 | RLS default-deny, service-role path |
| Ops packages | `packages/*` on this branch | E2 | Local foundation; not on `origin/main` |
| Command Center | `packages/cc` localhost:3100 | E2 | Passkey gate; operational access denied |
| Ops BFF | `packages/ops-api` | E2 | Synthetic Owner / local only |
| Workers | `packages/workers` | E1/E2 | One-shot stub; no scheduler/DLQ |
| Clerk identity | Development instance | E2–E4 local proofs | Production IdP = E0 |

## Architecture split (OBSERVED)

- Productive public web/API live in **repo root** Next.js app (`app/`, `components/`, `lib/`).
- `packages/web` and `packages/api` remain **skeletons**.
- Ops first-slice migrations `003`–`013` exist locally; not proven applied to production.

## Security foundation on this branch (OBSERVED)

| Item | Commit | Status |
|---|---|---|
| P3 local foundation | `501c1a6`…`8627fab` | Local complete |
| P4-H0a | `133ccee` | Accepted |
| P4-H0b2a | `f2cd91e` | Accepted |
| P4-H0b3b | `0f05b14` | Accepted |
| P4-H0b2b | `80b397c` | Accepted |
| P4-H0b4 | `955e849` | Accepted / frozen |
| Authn tests | 125/125 at H0b4 close | E2 |

## H0b3d (OBSERVED / OPEN)

- Owner reported account deletion + associated passkey removal during prior interactive cleanup.
- Final Users-overview readback (`H0B3_TEST_USER_COUNT=0`) was **not** completed before interruption.
- Invitation final status unproven.
- `/tmp` evidence for H0b3d/H0b4 is **gone** (temp loss). Persistent reconstruction is M6–M7.

## Explicit non-claims

```text
PRODUCTION_CC_DEPLOYED=NO
STRONG_AUTHZ_COMPLETE=NO
PRODUCTION_RLS_READY=NO
PRODUCTION_IDP_READY=NO
AUTOMATION_ACTIVATION=NO
CUSTOMER_MAIL_PRODUCTION=E0
GDPR_COMPLIANT=BOOLEAN_FORBIDDEN
```

## Safety backup (M0–M5)

```text
REMOTE_SAFETY_BRANCH=safety/dth-p3-p4-freeze-955e849
REMOTE_TIP=955e849d3f9006910a989727d9f21608a2f682e6
REMOTE_SAFETY_COMPLETE=YES
ORIGIN_MAIN=fea1a54653b064d49396c24dcd30c2122abd1b92
LOCAL_BUNDLE=PASS
```
