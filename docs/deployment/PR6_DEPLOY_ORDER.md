# PR #6 / production release sequence (binding)

```
VERCEL_GIT_CONNECTED=NO
AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO
PR6_DEPLOYMENT_SAFE=NO
PRODUCTION_E2E_READY=NO
PR6_MERGE_READY=YES
PRODUCTION_RELEASE_READY=NO
PUBLIC_LEGAL_ALIGNMENT=PASS
TECHNICAL_FACTUAL_PRIVACY_REVIEW=PASS
EXTERNAL_LEGAL_REVIEW_REQUIRED_FOR_MERGE=NO
LEGAL_ESCALATION_IF_SPECIFIC_ISSUE=YES
GDPR_PROCESSOR_EVIDENCE=PARTIAL
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
Checkdomain static publish remains a separate authorized step (GATE11–GATE12).
Therefore `PR6_DEPLOYMENT_SAFE=NO` even though `PR6_MERGE_READY=YES`.

External counsel is **optional escalation**, not a merge gate. No counsel
approval is recorded or invented. `GDPR_PROCESSOR_EVIDENCE=PARTIAL` stays an
ongoing governance item.

## Binding gate order

Preferred order. Changing it requires a written technical reason.

| Gate | Name | Status | May proceed when |
|---|---|---|---|
| GATE2 | Supabase Backup | **PASS** | Verified restorable/readable production DB backup artifact recorded. 2026-09-15: local custom-format `pg_dump` (~230 KB); `pg_restore -l` read 404 TOC entries. No PITR/snapshot ID invented |
| GATE3 | Migration 003 | **PASS** | Applied + verified on `deintarifheld-phase-a`. **Do not rerun** |
| GATE4 | Migration 004 | **PASS** | Applied + verified. **Do not rerun** |
| GATE5 | Migration 005 | **PASS** | Applied + verified (INVOKER + hardened `search_path`). **Do not rerun** |
| GATE6 | Production Env Verify | **PASS** | Production API required slots PRESENT; `ALLOW_CUSTOMER_MAIL=NO`; `LEADS_MAIL_MODE=internal_live` |
| GATE7 | Vercel Deployment Safety Verify | **PASS** | `VERCEL_GIT_CONNECTED=NO`; `AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO` |
| GATE8 | PR #6 Merge | **READY** | Controlled merge of this PR. Still not an API or Checkdomain deploy |
| GATE9 | Production API Deploy | OPEN | Intentional deploy of the **merged SHA** to `deintarifheld-leads-api` |
| GATE10 | API Smoke | OPEN | Ops-only; captcha required; no customer mail |
| GATE11 | Checkdomain live backup | OPEN | Current live tree backup (`dth-checkdomain.sh backup --apply`) |
| GATE12 | Final static build + Checkdomain deploy | OPEN | Build from **merged main** SHA; upload `--apply`. This publishes the still-stale live legal pages |
| GATE13 | Controlled Production E2E | OPEN | Separate written authorization; `docs/deployment/PRODUCTION_E2E_RUNBOOK.md` |
| GATE14 | Internal Resend mail verify | OPEN | Confirm internal ops notification only |
| GATE15 | Supabase + audit + admin inbox verify | OPEN | Storage, audit events, inbox readable |
| GATE16 | Customer mail stayed OFF | OPEN | Confirm `ALLOW_CUSTOMER_MAIL=NO` and no customer confirmation sent |
| GATE17 | Remove test lead cleanly | OPEN | Explicit admin deletion mode; no redacted-placeholder mass delete |
| GATE18 | Final release acceptance | OPEN | Human acceptance recorded |

If `AUTO_PRODUCTION_DEPLOY_ON_MAIN` is later proven **YES**, GATE7 must add a
deploy hold **before** GATE8. Never merge first and hope.

Never fail-open rate limit. Never enable customer mail from this PR. Never
re-apply migrations 003–005.

## Next product phase (after GATE13 PASS only)

Documented, **not** implemented here. Dual guard unchanged.

```
NEXT_PRODUCT_PHASE_AFTER_RELEASE=
A. Customer confirmation mail
B. automated follow-up mail
C. appointment suggestion / booking integration
D. reminder / no-response automation
E. CRM handoff
```

Detail: `docs/deployment/SUPABASE_MIGRATION_PREFLIGHT.md`, `PRODUCTION_ENV_MATRIX.md`, `VERCEL_TOPOLOGY.md`, `CHECKDOMAIN_CUTOVER_SEQUENCE.md`.
