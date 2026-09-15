# Vercel topology — what this repository can prove

```
VERCEL_PROJECT_VERIFIED=PARTIAL
VERCEL_GIT_CONNECTED=NO
AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO
VERCEL_ROLLBACK_READY=UNKNOWN
PR6_PREVIEW_ONLY=UNKNOWN
```

Human verified 2026-09-15: production Vercel Git is **not** connected and
`AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO`. No Vercel dashboard token was used in this
pass. **Do not treat merge as a production cutover.**

## Facts (evidenced)

| Fact | Evidence |
|---|---|
| Public forms target `https://deintarifheld-leads-api.vercel.app` | `lib/leads/browser-api.js` contract tests; live `/datenschutz` fetched 2026-09-15 |
| This git repo contains the Next App Router API (`app/api/leads`, `careers`, `admin`, `cron/retention`) | tree at HEAD `231321e` |
| `vercel.json` defines a daily cron `0 3 * * *` → `/api/cron/retention` | repo file |
| PR #6 GitHub check “Vercel” points at `averionhq/deintarifheld-staging` | GitHub check on this branch (preview/staging project, **not** proven to be production API) |
| Ops inbox URL documented as `https://deintarifheld-leads-api.vercel.app/api/admin/inbox/` | `.env.example`, E2E runbook |

## Unknown (human / Vercel must supply)

1. Which Vercel **project** is linked to production hostname `deintarifheld-leads-api.vercel.app` (may or may not be `deintarifheld-staging`).
2. Which **git branch** that project deploys as Production.
3. Whether a merge to `main` **auto-deploys** that Production project.
4. Whether PR #6 deployments are **preview-only**.
5. Env var sets for Development / Preview / Production (names exist in `.env.example`; presence UNKNOWN).
6. Deployment Protection (Vercel auth) on Production vs Preview.
7. Rollback path (Vercel instant rollback vs redeploy previous SHA).

Human-verified 2026-09-15 for the production API project:

```
VERCEL_GIT_CONNECTED=NO
AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO
PR6_DEPLOYMENT_SAFE=NO
```

Merging PR #6 must **not** be assumed to deploy production (Git is disconnected).
`PR6_MERGE_READY=YES` for a controlled merge. `PR6_DEPLOYMENT_SAFE=NO` until the
intentional API deploy and Checkdomain publish. External counsel is not a merge
blocker.
