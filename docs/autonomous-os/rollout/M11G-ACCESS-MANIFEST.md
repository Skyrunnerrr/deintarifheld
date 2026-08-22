# M11G Access Manifest

Machine-oriented privilege contract derived from code paths (not table-name guesses).

## Design

| Decision | Choice |
|----------|--------|
| Privilege placement | Dedicated NOLOGIN groups `dth_grp_public_intake`, `dth_grp_worker`, `dth_grp_ops_api` |
| `dth_grp_runtime` | Remains **empty** common marker (membership only) |
| Cross-workload collapse | FORBIDDEN |
| Credential cutover | Deferred (E2 contract only) |

## Required privileges

| WORKLOAD | OBJECT | OBJECT_TYPE | PRIVILEGE | CODE_PATH | BUSINESS_REASON | WRITE_EFFECT | EXTERNAL_EFFECT_RELEVANCE | REQUIRED_NOW | DEFERRED_GATE |
|----------|--------|-------------|-----------|-----------|-----------------|--------------|---------------------------|--------------|---------------|
| public_intake | public | SCHEMA | USAGE | a2/atomic-intake.js | Resolve qualified public objects | none | none | YES | |
| public_intake | public.leads | TABLE | SELECT,INSERT | a2/atomic-intake.js | Idempotent lead create | insert lead | none | YES | |
| public_intake | public.transactional_outbox | TABLE | SELECT,INSERT,UPDATE | a2/atomic-intake.js | Source outbox handoff | outbox row | none | YES | |
| public_intake | public.audit_events | TABLE | INSERT | a2/atomic-intake.js | Canonical intake audit | append | none | YES | |
| public_intake | ops | SCHEMA | USAGE | a13/attribution.js | Soft attr optional path | none | none | YES | |
| public_intake | ops.acquisition_refs | TABLE | SELECT | a13/tracking.js | Resolve opaque acq_ref | none | none | YES | |
| public_intake | ops.acquisition_touchpoints | TABLE | SELECT,INSERT | a13/tracking.js | Touchpoint write | insert | none | YES | |
| public_intake | ops.lead_attributions | TABLE | SELECT,INSERT | a13/attribution.js | Soft attribution | insert | none | YES | |
| worker | public,ops,security,workflow | SCHEMA | USAGE | packages/db/src/a* workflow | Domain automation | none | none | YES | |
| worker | security.control_state | TABLE | SELECT | workflow/claim.js | Fail-closed control read | none | none | YES | |
| worker | security.control_version | TABLE | SELECT | workflow/control.js | CONTROL_VERSION read | none | none | YES | |
| worker | workflow.jobs | TABLE | SELECT,INSERT,UPDATE | workflow/claim.js | Job lease | mutate jobs | none | YES | |
| worker | workflow.workflow_instances | TABLE | SELECT,INSERT,UPDATE | claim/handoff | Workflow progression | mutate | none | YES | |
| worker | workflow.job_attempts | TABLE | SELECT,INSERT,UPDATE | claim.js | Attempt ledger | mutate | none | YES | |
| worker | public.transactional_outbox | TABLE | SELECT,UPDATE | a2/source-outbox.js | Claim/drain | claim | none | YES | |
| worker | public.leads | TABLE | SELECT | a2/handoff.js | Handoff source | none | none | YES | |
| worker | public.cases | TABLE | SELECT,INSERT | a2/handoff.js | Case create from lead | insert | none | YES | |
| worker | public.audit_events | TABLE | INSERT | domain modules | Append audit | append | none | YES | |
| worker | ops.* (domain except operator_commands) | TABLE | SELECT,INSERT,UPDATE | packages/db/src/a2–a13 | Domain worker DML | mutate | provider intents later | YES | |
| worker | ops.tariff_* / energy_profiles / switch_facts | TABLE | DELETE | a7/catalogue.js a9/prepare.js | Catalogue/fact reset | delete | none | YES | |
| ops_api | public,ops,security,workflow | SCHEMA | USAGE | a11/* ops-api | CC/Ops server | none | none | YES | |
| ops_api | security.control_state | TABLE | SELECT,INSERT | workflow/control.js | Kill/pause/takeover upsert | mutate control | none | YES | |
| ops_api | security.control_version | TABLE | SELECT,UPDATE | control.js | Version bump | mutate | none | YES | |
| ops_api | security.control_audit | TABLE | INSERT | control.js | Control audit append | append | none | YES | |
| ops_api | workflow.* | TABLE | SELECT,INSERT,UPDATE | a11 commands | Reprocess/pause | mutate | none | YES | |
| ops_api | ops.operator_commands | TABLE | SELECT,INSERT,UPDATE | a11/commands.js | Operator command ledger | mutate | none | YES | |
| ops_api | ops.* (domain tables) | TABLE | SELECT,INSERT,UPDATE | a11 reads/commands | Bounded CC surface | mutate | none | YES | |
| ops_api | public.leads | TABLE | SELECT | a11 reads | Operator visibility | none | none | YES | |
| ops_api | public.cases | TABLE | SELECT,UPDATE | a11 commands | Case operator updates | update | none | YES | |
| ops_api | public.audit_events | TABLE | SELECT,INSERT | a11 | Audit read/append | append | none | YES | |
| ops_api | public.transactional_outbox | TABLE | SELECT | a11 reads | Outbox visibility | none | none | YES | |

## Explicit non-grants (deferred / denied)

| ITEM | REASON | DEFERRED_GATE |
|------|--------|---------------|
| Intake INSERT leads via Data API service_role | Current prod path | M11Q/S |
| Worker WRITE control_state/version/audit | Ops-only | — |
| Worker ops.operator_commands | Ops-only | — |
| Intake security/workflow | Not on intake path | — |
| Auth operator mapping | Human identity | M11H+ |
| Grant bundle on dth_grp_runtime | Would collapse workloads | — |

## Legacy ACL actions

| TARGET | ACTION | CLASS |
|--------|--------|-------|
| anon on public.leads/audit_events/career_applications | REVOKE ALL IF ROLE EXISTS | UNJUSTIFIED |
| authenticated same | REVOKE ALL IF ROLE EXISTS | UNJUSTIFIED |
| PUBLIC same | REVOKE ALL | UNJUSTIFIED |
| service_role same | KEEP | DATA_API_REQUIRED / DEFERRED_M11Q/S |
| Default privileges private + public future objects | REVOKE broad auto-grants | FUTURE_PRIVATE_OBJECT_BROAD_GRANTS=0 |
