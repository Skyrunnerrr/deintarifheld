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
```

Merging this PR is **not** a production cutover.

Human verified 2026-09-15: production Vercel Git is disconnected and
`AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO` (`docs/deployment/VERCEL_TOPOLOGY.md`).
Checkdomain static publish is still a separate authorized step. Therefore
`PR6_DEPLOYMENT_SAFE=NO`.

## Binding gate order

Preferred order. Changing it requires a written technical reason.

| Gate | Name | May proceed when |
|---|---|---|
| GATE1 | Legal Release Approval | Legal signs the matrix; published texts cover reCAPTCHA / ProvenExpert / cookies; AGB §5 vs mail OFF resolved **without** enabling customer mail; TTDSG/TDDDG decided; DPA/SCC/TIA evidence recorded or explicitly deferred |
| GATE2 | Supabase Backup | Snapshot/PITR id recorded |
| GATE3 | Migration 003 | 003 applied + verified |
| GATE4 | Migration 004 | 004 applied + verified |
| GATE5 | Migration 005 | 005 applied + verified (INVOKER) |
| GATE6 | Production Env Verify | Matrix `VERIFIED_PRESENT` filled (values never printed); `ALLOW_CUSTOMER_MAIL=NO`; no smoke-bypass; no memory rate-limit; no localhost origin |
| GATE7 | Vercel Deployment Safety Verify | Production project, production branch, and auto-deploy-on-main are **known**. If auto-deploy is ON, merge is blocked until a hold/protection exists |
| GATE8 | PR #6 Merge | Only after GATE1–GATE7. Still not a Checkdomain upload |
| GATE9 | Production API Deploy | Intentional deploy of the merged SHA to `deintarifheld-leads-api` |
| GATE10 | API Smoke | Ops-only; captcha required; no customer mail |
| GATE11 | Checkdomain Backup | `dth-checkdomain.sh backup --apply` |
| GATE12 | Checkdomain Static Deploy | Build from **main** SHA; upload `--apply` |
| GATE13 | Controlled Production E2E | Separate written authorization; `docs/deployment/PRODUCTION_E2E_RUNBOOK.md` |
| GATE14 | Monitoring | Inbox + mail_status + error logs watched |
| GATE15 | Release Acceptance | Human acceptance recorded |

If `AUTO_PRODUCTION_DEPLOY_ON_MAIN` is later proven **YES**, GATE7 must add a deploy hold **before** GATE8, or merge must wait until GATE2–GATE6 are already done on the live project. That is the only justified reorder: **never** merge first and hope.

Never fail-open rate limit. Never enable customer mail from this PR.

Detail: `docs/deployment/SUPABASE_MIGRATION_PREFLIGHT.md`, `PRODUCTION_ENV_MATRIX.md`, `VERCEL_TOPOLOGY.md`, `CHECKDOMAIN_CUTOVER_SEQUENCE.md`.
