# M11F Runtime LOGIN Roles

## Result

```text
M11F_RESULT=CLOSED_E2_LOCAL_HOSTED_ROLE_PROOF_PENDING
LOCAL_ROLE_CREATION_PROVEN=YES
HOSTED_ROLE_CREATION_NOT_PROVEN=YES
```

## Current-state audit (pre-M11F)

- Local disposable DB (`127.0.0.1:55432/dth_a1`): only `postgres` LOGIN present; no `anon`/`authenticated`/`service_role` on this host
- Private schemas present locally: `ops`, `security`, `workflow` (`audit` may be absent on some boots)
- No `CREATE ROLE` runtime roles before M11F
- Canonical plan names from `docs/autonomous-os/07_IMPLEMENTATION_PLAN.md` §11: `dth_public_intake`, `dth_ops_api`, `dth_worker`
- E2 tests still connect as elevated local postgres (workload cutover deferred)
- `service_role` retirement remains **M11S**
- No SECURITY DEFINER functions found under ops/security/workflow/public in local audit

## Role design

| Class | Decision |
|-------|----------|
| App / Command Center server | LOGIN `dth_ops_api` |
| Automation worker | LOGIN `dth_worker` |
| Public intake (future M11Q) | LOGIN `dth_public_intake` |
| Provider dispatcher | **Not separate LOGIN in V1** — remains on worker until evidence requires split |
| Privilege group | NOLOGIN `dth_grp_runtime` (empty; M11G will add grants) |
| Migration/admin | remains `postgres` / migration runner ≠ runtime LOGIN |

M11F intentionally grants **no** private schema/table privileges.

## Role inventory

| ROLE | LOGIN | Purpose | Member of | SUPERUSER | CREATEDB | CREATEROLE | REPLICATION | BYPASSRLS | Schema access | Table access | Search path | Next gate |
|------|-------|---------|-----------|-----------|----------|------------|-------------|-----------|---------------|--------------|-------------|-----------|
| dth_grp_runtime | NO | Future grant carrier | — | NO | NO | NO | NO | NO | none | none | pg_catalog | M11G |
| dth_ops_api | YES | Ops/app/CC server identity | dth_grp_runtime | NO | NO | NO | NO | NO | none | none | pg_catalog | M11G |
| dth_worker | YES | Automation worker identity | dth_grp_runtime | NO | NO | NO | NO | NO | none | none | pg_catalog | M11G |
| dth_public_intake | YES | Future direct intake identity | dth_grp_runtime | NO | NO | NO | NO | NO | none | none | pg_catalog | M11G / M11Q |

## Migration

`supabase/migrations/20260821120000_m11f_runtime_login_roles.sql`

- Additive, idempotent guarded `CREATE ROLE`
- No credential secrets in SQL
- No Data API changes
- Local test passwords set only in test harness via `ALTER ROLE` (not committed)

## Local proof

`npm run test:dth:m11f` → **14/14 PASS**

Covers inventory, attributes, membership, connection identity, escalation negatives, private-schema denial, search_path, anon/auth boundary when roles exist.

## service_role migration map (for later)

| Usage | Class |
|-------|-------|
| Public intake Data API (prod path docs) | TARGET_FOR_RUNTIME_ROLE_REPLACEMENT → M11Q then M11S |
| Historical grants on public.leads (002_leads) | REQUIRED_CURRENTLY until M11Q/S |
| Local E2 postgres pool | TEST_ONLY / LOCAL_TEST elevated |
| Migration runner | MIGRATION_ONLY |

## M11G handoff

Grant least-privilege object rights to `dth_grp_runtime` / specific LOGINs. Do not widen anon/authenticated. Do not start Auth mapping (M11H).

## Hosted limitations

Supabase may restrict role creation attributes. Hosted creation/readback: **NOT_PROVEN**.
