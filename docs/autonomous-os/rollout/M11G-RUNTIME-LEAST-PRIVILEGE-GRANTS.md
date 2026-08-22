# M11G Runtime Least-Privilege Grants

## Result

```text
M11G_RESULT=CLOSED_E2_LOCAL_HOSTED_GRANT_PROOF_PENDING
LOCAL_GRANT_CREATION_PROVEN=YES
HOSTED_GRANT_PROOF=NOT_PROVEN
```

## Design (no cross-workload collapse)

| Role | Purpose | Privileges on |
|------|---------|---------------|
| `dth_grp_runtime` | Empty marker only | **none** |
| `dth_grp_public_intake` | Narrow B2B intake + optional A13 soft attr | `public.leads` SI, `transactional_outbox` SIU, `audit_events` I; `ops.acquisition_refs` S; `ops.acquisition_touchpoints` SI; `ops.lead_attributions` SI |
| `dth_grp_worker` | A1–A13 automation | `security.control_*` **SELECT only**; `workflow.*` SIU; `public` handoff spine; `ops.*` SIU except `operator_commands`; DELETE on tariff catalogue + `switch_facts` only |
| `dth_grp_ops_api` | Command Center / control plane | `security.control_*` read/write (bounded); `workflow.*` SIU; `ops.*` SIU incl. `operator_commands`; `public` read/append surfaces |

Membership:

```text
dth_public_intake → dth_grp_runtime, dth_grp_public_intake
dth_worker        → dth_grp_runtime, dth_grp_worker
dth_ops_api       → dth_grp_runtime, dth_grp_ops_api
```

## Migrations

| File | Purpose |
|------|---------|
| `20260822100000_m11g_workload_privilege_groups.sql` | NOLOGIN workload groups + LOGIN membership |
| `20260822110000_m11g_runtime_least_privilege_grants.sql` | Table/schema grants per group (dynamic `ops.*`) |
| `20260822120000_m11g_legacy_acl_and_default_privileges.sql` | ACL-02 revoke + default-privilege hardening |
| `20260822130000_m11g_intake_rls_policies.sql` | Minimal intake RLS (required to prove grants under RLS) |

## Access manifest

See `M11G-ACCESS-MANIFEST.md`.

## Local proof

`npm run test:dth:m11g` → **18/18 PASS**

Positive: intake `acceptBusinessLeadAtomic`, worker `readFreshControlSnapshot`, ops control audit insert (rolled back).

Negative: cross-workload denial, no SET ROLE escalation, no `dth_grp_runtime` object grants, future default-privilege synthetic table.

## ACL-02 cleanup

Revoked unjustified `PUBLIC` / `anon` / `authenticated` grants on `public.leads`, `audit_events`, `career_applications`, `cases`, `transactional_outbox` (when roles exist).

`service_role` grants **kept** until M11Q/S.

## RLS handoff

Intake policies are minimal proof-only. Full RLS completion → **M11L/M**.

## service_role handoff

| Current | Target | Gate |
|---------|--------|------|
| Data API public spine DML | `dth_public_intake` | M11Q |
| Worker automation pool | `dth_worker` | post-M11G cutover |
| Ops/CC server pool | `dth_ops_api` | post-M11H-K |
| Retirement | — | M11S |

## M11H handoff

Workload DB identities + grants are ready. Next: Supabase Auth `auth.users.id` → operator mapping (**M11H**). Do not start automatically.

## Hosted limitations

Grant application/readback on hosted Supabase: **NOT_PROVEN**.
