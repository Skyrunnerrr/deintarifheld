# PR #6 / production release sequence (binding)

```
VERCEL_GIT_CONNECTED=NO
AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO
PR6_DEPLOYMENT_SAFE=NO
PRODUCTION_E2E_READY=NO
PR6_MERGE_READY=NO
PRODUCTION_RELEASE_READY=NO
PUBLIC_LEGAL_ALIGNMENT=PASS
LEGAL_REVIEW_REQUIRED=YES
GATE1=OPEN
GATE2=PASS
GATE3=PASS
GATE4=PASS
GATE5=PASS
GATE6=PASS
GATE7=PASS
```

Merging this PR is **not** a production cutover.

Human verified 2026-09-15: production Vercel Git is disconnected and
`AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO` (`docs/deployment/VERCEL_TOPOLOGY.md`).
Checkdomain static publish is still a separate authorized step. Therefore
`PR6_DEPLOYMENT_SAFE=NO`.

## Binding gate order

Preferred order. Changing it requires a written technical reason.

| Gate | Name | Status | May proceed when |
|---|---|---|---|
| GATE1 | Legal Release Approval | **OPEN** | Qualified legal review signs the aligned repo texts. Repo factual mismatches are already closed; live Checkdomain pages remain stale; DPA/SCC/TIA account evidence remains PARTIAL |
| GATE2 | Supabase Backup | **PASS** | Verified restorable/readable production DB backup artifact recorded. The artifact used on 2026-09-15 is a local custom-format `pg_dump` (~230 KB) whose TOC was readable via `pg_restore -l` (404 entries). A PITR/snapshot ID is **not** required and was **not** invented |
| GATE3 | Migration 003 | **PASS** | 003 applied + verified on `deintarifheld-phase-a`. Do not rerun |
| GATE4 | Migration 004 | **PASS** | 004 applied + verified. Do not rerun |
| GATE5 | Migration 005 | **PASS** | 005 applied + verified (INVOKER + hardened `search_path`). Do not rerun |
| GATE6 | Production Env Verify | **PASS** | Production **API** required slots human-verified PRESENT (values never printed); `ALLOW_CUSTOMER_MAIL=NO`; `LEADS_MAIL_MODE=internal_live`. Checkdomain build-host `NEXT_PUBLIC_LEADS_API_ORIGIN` remains PARTIAL for later static publish |
| GATE7 | Vercel Deployment Safety Verify | **PASS** | Production Vercel Git disconnected; `AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO`. Merge cannot auto-deploy production |
| GATE8 | PR #6 Merge | OPEN | Only after GATE1 (and GATE2–GATE7, already PASS). Still not a Checkdomain upload |
| GATE9 | Production API Deploy | OPEN | Intentional deploy of the merged SHA to `deintarifheld-leads-api` |
| GATE10 | API Smoke | OPEN | Ops-only; captcha required; no customer mail |
| GATE11 | Checkdomain Backup | OPEN | `dth-checkdomain.sh backup --apply` |
| GATE12 | Checkdomain Static Deploy | OPEN | Build from **main** SHA; upload `--apply` |
| GATE13 | Controlled Production E2E | OPEN | Separate written authorization; `docs/deployment/PRODUCTION_E2E_RUNBOOK.md` |
| GATE14 | Monitoring | OPEN | Inbox + mail_status + error logs watched |
| GATE15 | Release Acceptance | OPEN | Human acceptance recorded |

If `AUTO_PRODUCTION_DEPLOY_ON_MAIN` is later proven **YES**, GATE7 must add a deploy hold **before** GATE8, or merge must wait until GATE1 plus the remaining live cutover holds exist. That is the only justified reorder: **never** merge first and hope.

Never fail-open rate limit. Never enable customer mail from this PR.

Detail: `docs/deployment/SUPABASE_MIGRATION_PREFLIGHT.md`, `PRODUCTION_ENV_MATRIX.md`, `VERCEL_TOPOLOGY.md`, `CHECKDOMAIN_CUTOVER_SEQUENCE.md`.
