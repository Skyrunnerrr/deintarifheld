# DTH-M11C — Staging Environment Foundation

```text
TRANCHE=DTH-M11C
DATE=2026-08-13
BASELINE_HEAD=8fa767c445eb698c729c7e4f5f848dbc50a7f711
M11ABF=PASS
STATUS=PASS (R2/R3/R4 complete; freeze pending M11CF)
PRODUCTION_MUTATED=NO
SOURCE_CODE_CHANGED=NO
MIGRATION_FILES_CHANGED=NO
COMMIT_CREATED=NO
PUSH_EXECUTED=NO
```

## Pre-flight

```text
HEAD=8fa767c445eb698c729c7e4f5f848dbc50a7f711
BRANCH=feat/deintarifheld-production-cutover-001
WORKTREE=CLEAN
SOURCE_CODE_CHANGED=NO
CONFIG_CHANGED=NO
MIGRATION_CHANGED=NO
M11C_PRE_FLIGHT=PASS
```

## Topology decision

```text
STAGING_TOPOLOGY_ID=DTH-STG-A
STAGING_TOPOLOGY_NAME=Dedicated Supabase Staging Project
STAGING_TOPOLOGY_DECISION=PASS
ALTERNATIVE_REJECTED=Persistent Supabase Branch
```

Rationale (inference + provider docs alignment):
- stronger environment/credential isolation
- lower accidental promotion / merge-to-production blast radius
- Production not GitHub-connected → branching operational gain is low for DTH now
- Supabase managing-environments documents separate staging + production projects
- safer for later destructive RLS/role tests
- Persistent branches are isolated and data-less by default, but still promote into the parent project model

No material provider/account blocker observed against DTH-STG-A.

## Production guard / link safety

```text
PRODUCTION_PROJECT_NAME=deintarifheld-phase-a
PRODUCTION_PROJECT_REF=ylvczlldcgaxyadlawtb
REPO_LINKED_CONTEXT=PRODUCTION
STAGING_PROJECT_REF=UNKNOWN (not created)
TARGET_FOR_MUTATION=NONE (stopped before mutation)
```

Hard stop: no mutation through Production-linked context. No temporary relink.

## Tooling

```text
CLI_REQUIRED=YES
CLI_AVAILABLE=NO
LOCAL_SUPABASE_BIN=NO
PACKAGE_SUPABASE_DEP=NO
OWNER_TOOLING_ACTION_REQUIRED=YES
PREFERRED_MECHANISM=Owner-approved Supabase CLI + explicit Staging target
FALLBACK=Owner-assisted Staging SQL apply of 001/002 only (canonical files)
DASHBOARD_PASTE_DEFAULT=NO (deviation requires Owner accept)
```

Minimal Owner setup option (host mutation — needs approval):

```text
brew install supabase/tap/supabase
supabase --version
```

## Canonical migrations (not applied)

```text
CANONICAL_APPLY_ROOT=supabase/migrations/
001_SHA256=b693de3cfa8ccfc9f9586c7d7086a91721904956940b0c8e5fe9ed6531209e00
002_SHA256=1caca2aa66e01ffa38cadd36b9de93f07c0be2b37a0480878f22163949ee89cd
M001_STAGING=NOT_APPLIED
M002_STAGING=NOT_APPLIED
M003_013_STAGING=NO
DRAFTS_APPLIED=NO
```

## Isolation / data / secrets (current)

```text
STAGING_PROJECT_CREATED=NO
PRODUCTION_SECRET_REUSE=NO (nothing provisioned)
PRODUCTION_PII_PRESENT=NO
STAGING_DATA_CLASS=N/A (no staging DB yet)
REAL_EXTERNAL_SENDS=NOT_CONFIGURED_AND_NO_STAGING_RUNTIME
STAGING_IDP_REQUIRED_NOW=NO
STAGING_APP_DEPLOYED=NO
```

## Production non-mutation

```text
PRODUCTION_DB_MUTATION=NO
PRODUCTION_SCHEMA_MUTATION=NO
PRODUCTION_ROLE_MUTATION=NO
PRODUCTION_CONFIG_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
```

## Secret inventory (classes only; no values)

| Class | Purpose | Owner | Env | Used in M11C? | Rotation | Prod reused |
|---|---|---|---|---|---|---|
| STAGING_DB_ADMIN_OR_MIGRATION_CREDENTIAL | apply/verify migrations | Owner | STAGING | YES (after create) | as needed | NO |
| STAGING_PROJECT_URL | project identity / API host | Owner | STAGING | YES (metadata) | N/A | NO |
| STAGING_PUBLIC_KEY_IF_REQUIRED | later app if needed | Owner | STAGING | NO now | as needed | NO |
| STAGING_SECRET_KEY_IF_REQUIRED_LATER | later app if needed | Owner | STAGING | NO now | as needed | NO |
| STAGING_RUNTIME_DB_CREDENTIALS_LATER | M11F+ roles | Owner | STAGING | NO now | as needed | NO |

## Evidence persistence

```text
PREFERRED_RAW=/Users/noahbez/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/DTH-M11C/
WORKSPACE_GITIGNORED=docs/autonomous-os/evidence/DTH-M11C/
PERSISTENT_EVIDENCE_LOCATION=APP_SUPPORT_PLUS_WORKSPACE_GITIGNORED
EVIDENCE_LEVEL=E2 planning/stop-gate (not E4 staging existence yet)
```

## Open blockers (ordered)

1. OWNER create dedicated Staging project `deintarifheld-staging` (empty; no prod clone/backup/PII)
2. OWNER approve CLI install OR accept Owner-assisted 001/002 Staging apply path
3. Resume M11C with STAGING_PROJECT_REF ≠ PRODUCTION_PROJECT_REF, then apply+readback+fingerprint

## Gate

```text
M11C=OPEN
REASON=Staging project not created; safe canonical migration tooling unavailable; Production-linked repo context blocks mutation until explicit Staging targeting exists.
```

## Recommended next action

```text
RECOMMENDED_NEXT_ACTION=OWNER_CREATE_DEDICATED_STAGING_PROJECT_THEN_APPROVE_CLI_OR_OWNER_ASSISTED_001_002_APPLY
```

Do NOT start M11D. Do NOT freeze. Do NOT commit until PASS.


## DTH-M11C-R1 (Owner values received)

```text
STAGING_PROJECT_CREATED=YES
STAGING_PROJECT_NAME=deintarifheld-staging
STAGING_PROJECT_REF=uunpbmfvbfkideylhtbl
STAGING_REGION=Central EU (Frankfurt)
DASHBOARD_main_PRODUCTION_LABEL=EXPECTED_BASE_BRANCH_LABEL (not DTH Production project)
PRODUCTION_PROJECT_REF=ylvczlldcgaxyadlawtb
PROJECTS_DIFFERENT=YES
```

### R1 execution

```text
1_npx_supabase_version=PASS (2.114.0)
2_isolated_worktree=PASS (/Users/noahbez/WORKTREES/dth-m11c-staging-8fa767c @ 8fa767c)
3_link_staging_only=BLOCKED (CLI hung; no linked-project.json written)
4_identity_readback=NOT_RUN
5_db_push_dry_run=NOT_RUN (stopped before mutation/ambiguous target)
6_003_013_gate=N/A_PRE_DRY_RUN
STAGING_MUTATED=NO
PRODUCTION_MUTATED=NO
```

### Owner next (no secrets in chat)

```text
RECOMMENDED_NEXT_ACTION=OWNER_SUPABASE_LOGIN_THEN_LINK_STAGING_WORKTREE
WORKTREE=/Users/noahbez/WORKTREES/dth-m11c-staging-8fa767c
COMMAND_HINT=
  cd /Users/noahbez/WORKTREES/dth-m11c-staging-8fa767c
  npx supabase login
  npx supabase link --project-ref uunpbmfvbfkideylhtbl
Then return to Cursor for dry-run only (still no apply).
```

Do NOT paste DB password into chat. Prefer interactive prompt or approved secret store env.


## DTH-M11C-R2 / R3 / R4 Summary

```text
M11C-R2=PASS  baseline-only workdir dry-run exactly 001+002
M11C-R3=PASS  applied 001+002 to Staging uunpbmfvbfkideylhtbl only
M11C-R4=PASS  structural parity vs Production baseline YES
```

### Staging identity

```text
STAGING_PROJECT_NAME=deintarifheld-staging
STAGING_PROJECT_REF=uunpbmfvbfkideylhtbl
STAGING_REGION=eu-central-1
PRODUCTION_PROJECT_REF=ylvczlldcgaxyadlawtb
PROJECTS_DIFFERENT=YES
```

### Migration history (Staging)

```text
REMOTE_001=YES
REMOTE_002=YES
REMOTE_003_013=NO
```

### Structural parity (R4)

```text
TABLES=public.leads, public.career_applications, public.audit_events
COLUMNS=38 MATCH
CONSTRAINTS=11 MATCH
INDEXES=16 MATCH
TRIGGERS=0 MATCH
RLS=enabled FORCE=false POLICIES=0 MATCH
OWNERS=postgres MATCH
TARGET_PRIVATE_SCHEMAS=ABSENT
LOCAL_ONLY_OPS_TABLES=ABSENT
STAGING_ACL_01_REPRODUCED=YES (expected debt → M11E)
STAGING_ACL_02_REPRODUCED=YES (expected debt → M11G)
ROLE_BASELINE=anon/auth BYPASSRLS=false; service_role BYPASSRLS=true; dth_*=none
STAGING_SCHEMA_FINGERPRINT_HASH=f59f5e619c4a5909bec409c797cc094726b2dd7f9d6a2493bab9dc092863e8de
HASH_DIRECT_COMPARISON=NOT_VALID (different canonicalization vs Prod fingerprint)
STAGING_APP_STRUCTURE_MATCHES_PRODUCTION_BASELINE=YES
NO_UNEXPLAINED_STRUCTURAL_DRIFT=YES
```

### Safety

```text
PRODUCTION_MUTATED=NO
R4_STAGING_MUTATION=NO
CUSTOMER_ROWS_QUERIED=NO
SEED_APPLIED=NO
PRODUCTION_DATA_COPIED=NO
REAL_EXTERNAL_RUNTIME=NOT_CONFIGURED_AND_NO_STAGING_RUNTIME
```

### Evidence paths

```text
APP_SUPPORT=~/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/DTH-M11C/
WORKSPACE_GITIGNORED=docs/autonomous-os/evidence/DTH-M11C/
SCHEMA_DUMP_SHA256=ced422850094944822cd9a2d35ce3193c68b5c910328785ce8e3223cc2023c71
```

### Gates

```text
M11C_R4=PASS
M11C=PASS
RECOMMENDED_NEXT_TRANCHE=DTH-M11CF_STAGING_BASELINE_FREEZE
M11D=NOT_STARTED
```

## M11CF FREEZE NOTE

```text
M11C=PASS frozen by DTH-M11CF.
STAGING_BASELINE_FROZEN=YES
Next=M11D Staging-only DDL/migration custody (prove provider-managed roles first).
```
