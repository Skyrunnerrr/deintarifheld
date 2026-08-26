# M11P Staging Security Runtime Evidence

**Date:** 2026-08-26  
**Project:** `deintarifheld-staging` / `uunpbmfvbfkideylhtbl`  
**Production interlock:** `ylvczlldcgaxyadlawtb` — **not mutated**

## Execution summary

```text
TARGET_PROJECT_REF=uunpbmfvbfkideylhtbl
TARGET_ENVIRONMENT=STAGING
PRODUCTION_DB_MUTATIONS=0
```

## Migration state — before

| Range | Remote state |
|-------|--------------|
| 001, 002 | Applied |
| M11E (20260813104040, 20260813171649) | Applied |
| A1–A13 + M11F–M (22 files) | **Pending** |

## Migration apply

Command (staging-only):

```text
supabase db push --project-ref uunpbmfvbfkideylhtbl --yes
```

Applied successfully (22 migrations):

1. `20260816090000_a1_durable_workflow_runtime.sql`
2. `20260816094500_a2_lead_case_handoff.sql`
3. `20260816100000_a3_b2b_qualification.sql`
4. `20260817100000_a4_communication_engine.sql`
5. `20260817120000_a5_calendar_appointment.sql`
6. `20260817140000_a6_document_intelligence.sql`
7. `20260817160000_a7_energy_tariff_domain.sql`
8. `20260817180000_a8_offer_domain.sql`
9. `20260818120000_a9_switching_workflow.sql`
10. `20260818140000_a10_customer_lifecycle.sql`
11. `20260818180000_a11_command_center.sql`
12. `20260818190000_a12_content_autopilot.sql`
13. `20260820120000_a13_acquisition_autopilot.sql`
14. `20260821120000_m11f_runtime_login_roles.sql`
15. `20260822100000_m11g_workload_privilege_groups.sql`
16. `20260822110000_m11g_runtime_least_privilege_grants.sql`
17. `20260822120000_m11g_legacy_acl_and_default_privileges.sql`
18. `20260822130000_m11g_intake_rls_policies.sql`
19. `20260822140000_m11h_operator_identity_mapping.sql`
20. `20260822150000_m11i_operator_role_capability_mapping.sql`
21. `20260822160000_m11j_operator_command_authz.sql`
22. `20260822170000_m11l_operator_context_rls.sql`
23. `20260822180000_m11m_business_data_scope_rls.sql`

## Migration state — after (readback)

```text
supabase migration list --project-ref uunpbmfvbfkideylhtbl
```

Result: **all 27 local migrations match remote** (001 through 20260822180000).  
`pending_count=0`

## Post-migration catalog readback

Full `pg_roles` / `pg_policies` SQL readback via CLI `db query` was **blocked** because workspace CLI link points to production (`ylvczlldcgaxyadlawtb`). Staging-targeted `db push` and `migration list --project-ref` succeeded; catalog verification requires staging `DTH_STAGING_*_DATABASE_URL` in a follow-up readback step.

**Expected objects (from migration chain):**

- LOGIN roles: `dth_ops_api`, `dth_worker`, `dth_public_intake`, `dth_grp_runtime`
- Schemas: `security`, `ops`, `workflow`, `audit` (+ business domains from A1–A13)
- M11H/I tables, M11L/M RLS policies, M11O `security.control_state`

## Runtime credentials — NOT YET PROVISIONED

M11F creates roles without passwords in SQL. Owner must inject:

| Role | Env var (proposed) | Status |
|------|-------------------|--------|
| `dth_ops_api` | `DTH_STAGING_OPS_DATABASE_URL` | NOT_STARTED |
| `dth_worker` | `DTH_STAGING_WORKER_DATABASE_URL` | NOT_STARTED |
| `dth_public_intake` | `DTH_STAGING_INTAKE_DATABASE_URL` | NOT_STARTED (M11Q scope) |

```text
STAGING_PRODUCTION_SECRET_REUSE=0 (policy)
STAGING_OPS_RUNTIME_DB_ROLE=dth_ops_api (target; not wired yet)
```

## Synthetic data / operators

NOT_STARTED — requires hosted Auth users + M11H/I seed on staging.

## Result

```text
STAGING_MIGRATION_READBACK=PASS (migration table sync)
STAGING_SECURITY_RUNTIME=PARTIAL (schema applied; runtime wiring pending)
STAGING_OPS_IDENTITY_ALIGNMENT=NOT_PROVEN
```
