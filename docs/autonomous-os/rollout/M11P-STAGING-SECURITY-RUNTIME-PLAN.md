# M11P Staging Security Runtime Plan

**Status:** PLAN_ONLY — no staging mutations executed in this mission  
**Staging project (historical evidence):** `deintarifheld-staging` / `uunpbmfvbfkideylhtbl`  
**Production project (reference only):** `deintarifheld-phase-a` / `ylvczlldcgaxyadlawtb`  
**Isolation:** PROJECTS_DIFFERENT=YES (M11CF)

## Current staging state (evidence-based)

| Item | State | Evidence |
|------|-------|----------|
| Staging project exists | YES | `DTH-M11C.md`, `DTH-M11CF.md` |
| Migrations applied | **001, 002 only** | M11CF freeze |
| M11E–M11M on staging | **NOT applied** | `A14-06` MIGRATION=NOT_STARTED |
| `dth_*` LOGIN roles on staging | **NONE** | M11CF: `dth_*=NONE` |
| RLS policies (security/ops) | **NOT implemented** | M11CF policy_count=0 |
| Staging CC/Ops hosts | NOT_STARTED | `A14-06` STAGING_RUNTIME |
| Staging secrets registry | NOT_STARTED | `A14-06` SECRETS |
| Production PII copied | NO | M11C policy |
| `supabase/config.toml` in repo | ABSENT | CLI link per worktree |

```text
PRODUCTION_CUSTOMER_DATA_COPIED_TO_STAGING=0
STAGING_PRODUCTION_SECRET_REUSE=0 (must remain 0)
PRODUCTION_DB_MUTATIONS=0
```

## Required security state for M11P

Reuse existing migration chain — **no cherry-picked SQL**:

| Gate | Migration prefix | Staging status |
|------|------------------|----------------|
| M11E | `20260813104040`, `20260813171649` | PENDING |
| A1–A13 | `20260816090000` … `20260820120000` | PENDING |
| M11F | `20260821120000` | PENDING |
| M11G | `20260822100000` … `20260822130000` | PENDING |
| M11H | `20260822140000` | PENDING |
| M11I | `20260822150000` | PENDING |
| M11J | `20260822160000` | PENDING |
| M11L | `20260822170000` | PENDING |
| M11M | `20260822180000` | PENDING |
| M11N app wiring | Code deploy + `DTH_AUTH_MODE=hosted` | PENDING |
| M11O control | Included in A1/M11L migrations | PENDING on staging |

**Total pending after 001/002:** 25 migration files (chronological apply via Supabase CLI).

## STAGING_MIGRATION_PLAN

```text
STAGING_MIGRATION_PLAN=
  1. Owner: supabase login + link --project-ref uunpbmfvbfkideylhtbl (isolated worktree)
  2. supabase db push --dry-run (review full chain)
  3. supabase db push (staging only; verify target ref before apply)
  4. Post-apply readback: roles, RLS, FORCE RLS, policies, security schema
  5. Set LOGIN passwords for dth_ops_api / dth_worker / dth_public_intake via secret manager
  6. Seed synthetic operators (M11H/I) + minimal test fixtures
  7. Deploy staging Ops BFF + CC with hosted auth env (no prod secrets)

STAGING_MIGRATION_RISK=MEDIUM
  - Large DDL batch; security tightening (REVOKE, FORCE RLS)
  - No customer data expected; synthetic only
  - Rollback: staging project restore from pre-apply snapshot or destroy/recreate (Owner policy)

DESTRUCTIVE_MIGRATIONS=
  - None drop production tables; security migrations REVOKE broad grants and ENABLE/FORCE RLS
  - Review each M11G/M11L/M11M file before apply (no manual edits)

EXPECTED_ROLES=
  dth_grp_runtime (NOLOGIN)
  dth_ops_api (LOGIN)
  dth_worker (LOGIN)
  dth_public_intake (LOGIN)

EXPECTED_POLICIES=
  M11L/M11M RLS on security.*, ops.*, workflow.*, public protected tables
  Capability-aware operator policies (M11M)
```

## Staging runtime identity target

| Workload | Target identity | Current app code | M11P staging requirement |
|----------|-----------------|------------------|--------------------------|
| Ops / CC human path | `dth_ops_api` | Often `postgres` / injected pool locally | **REQUIRED for honest E4** — wire staging `DTH_OPS_DATABASE_URL` |
| Automation worker | `dth_worker` | Often `postgres` in tests | E4 scope: ops path first; worker negative/positive as needed |
| Public intake | `dth_public_intake` | `SUPABASE_SERVICE_ROLE_KEY` (leads) | **Out of M11P ops proof** — document path; M11Q/S owns cutover |
| Admin / migrate | `postgres` / CI custody | M11D model | Migration only — not normal runtime |

### Runtime identity open risk (honest)

```text
M11-OPEN-RUNTIME-DATABASE-IDENTITY-ALIGNMENT=OPEN
```

- **Production app factories:** EXPLICIT_LATER_GATE (M11M documented)  
- **M11P staging E4:** Requires Ops BFF DB pool as `dth_ops_api` for honest AuthZ→RLS→Ops proof  
- **Do NOT** claim runtime alignment closed if staging proof still uses `postgres`  
- **Do NOT** fake proof — wire staging secrets only

```text
STAGING_RUNTIME_ADMIN_CREDENTIAL_PATHS=
  postgres allowed for migration/DDL custody only
  service_role NOT acceptable as ops runtime proof path
```

## Staging secret model (names only)

| SECRET | PURPOSE | STORAGE | CLIENT_VISIBLE | PROD_SHARED | STATUS |
|--------|---------|---------|----------------|-------------|--------|
| `STAGING_SUPABASE_URL` | Auth + API host | Staging secret store | anon key only | NO | NOT_STARTED |
| `STAGING_SUPABASE_ANON_KEY` | Browser Auth | Staging env | YES (publishable) | NO | NOT_STARTED |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | Leads intake (until M11Q) | Server only | NO | NO | NOT_STARTED |
| `DTH_STAGING_OPS_DATABASE_URL` | Ops BFF as `dth_ops_api` | Server only | NO | NO | NOT_STARTED |
| `DTH_STAGING_WORKER_DATABASE_URL` | Workers as `dth_worker` | Server only | NO | NO | NOT_STARTED |
| `CRON_SECRET` / staging variants | Automation auth | Server only | NO | NO | NOT_STARTED |

## Synthetic staging identities

| Identity | Purpose |
|----------|---------|
| `STAGING_OPERATOR` | Positive E4 path (AAL2 + CASE_VIEW or similar) |
| `STAGING_VIEWER` | Wrong capability negative |
| `STAGING_APPROVER` | Elevated capability positive (if needed) |
| `STAGING_UNPROVISIONED` | Auth user without M11H mapping |
| `STAGING_DISABLED` | M11H DISABLED operator |

All synthetic — no real employee/customer accounts. TOTP via staging enroll flow.

## Synthetic test data (minimal)

- One ops case row (synthetic company name)
- One operator command fixture
- Control state readable for kill check
- No real PII / documents / tariff contracts

## service_role note

Public leads path (`lib/leads/supabase.js`) uses `SUPABASE_SERVICE_ROLE_KEY`.  
**SERVICE_ROLE_RETIREMENT** remains M11S. M11P documents but does not test intake path as least-privilege.

## Phase C success criteria

```text
STAGING_SECURITY_RUNTIME=NOT_READY
```

Ready when: migrations applied + roles verified + staging Ops uses `dth_ops_api` + synthetic seed + secrets separated.

## Execution authorization

This mission: **PLAN ONLY**. Apply requires Owner approval + explicit staging mutation gate.
