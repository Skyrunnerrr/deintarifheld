# Checkdomain cutover sequence (do not upload)

```
CHECKDOMAIN_PREFLIGHT=PASS
CHECKDOMAIN_BACKUP_READY=YES
CHECKDOMAIN_ROLLBACK_READY=YES
CHECKDOMAIN_UPLOAD_EXECUTED=NO
```

Scripts exist and were inspected. **No SFTP, no backup apply, no upload** in this pass.
`BACKUP_READY` / `ROLLBACK_READY` mean the **procedure exists**, not that a current live backup is on disk.

## Inspected artifacts

| Artifact | Path | Status |
|---|---|---|
| Static export | `npm run build:static` / `scripts/build-static.sh` | present |
| Production static | `npm run build:static:production` / `scripts/build-static-production.sh` (fail-closed without API origin; parks `app/api`) | present |
| Static verify | `npm run verify:static:production` | present |
| Cutover plan | `npm run cutover:plan` | present |
| Deploy automation | `scripts/deploy/checkdomain/dth-checkdomain.sh` (`plan\|backup\|upload\|verify\|rollback\|status`) | present; default dry-run; `--apply` required for writes |
| `.htaccess` | `public/.htaccess` | HTTPS + apex→www; HSTS/CSP including reCAPTCHA, ProvenExpert, Vercel API origin |
| Credentials | `infra/checkdomain/config.env` (gitignored) | CONFIG presence UNKNOWN on this agent host |

Upload never wipes the remote tree first. Apply path stages `releases/<timestamp>/`, promotes `_next`/images first, HTML last. Mail gate: `LEADS_MAIL_MODE=mock` blocks `--apply` unless `ALLOW_MOCK_MAIL_CUTOVER=YES`.

## Exact cutover order (ops, GATE11–GATE12 after GATE9–GATE10)

1. **Backup current site** — `dth-checkdomain.sh backup --apply` (requires `CHECKDOMAIN_SSH_IDENTITY`). Confirm `LATEST` stamp + `MANIFEST.sha256`.
2. **Build production static** — from **merged `main` SHA** (`LIVE_BUILD_SOURCE_BRANCH=main`). `NEXT_PUBLIC_LEADS_API_ORIGIN=https://deintarifheld-leads-api.vercel.app`. `npm run build:static:production`.
3. **Verify production static** — `npm run verify:static:production` (no GAS URLs, no localhost endpoints, no leaked keys).
4. **API health check** — Production API accepts an authenticated ops health/inbox probe; captcha still required on public POST. No customer mail.
5. **Upload** — `dth-checkdomain.sh upload --apply` only if mail gate PASS and backup exists.
6. **Smoke / verify** — `dth-checkdomain.sh verify --apply` (`/ /unternehmen/ /karriere/ /rechner/ /datenschutz/`).
7. **Rollback trigger** — `dth-checkdomain.sh rollback --apply` restores the last backup tree via SFTP. DNS change not required.

Do not upload this feature branch. `MERGE_BEFORE_PUBLIC_UPLOAD=YES`.
