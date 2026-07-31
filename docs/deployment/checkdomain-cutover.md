# Checkdomain static cutover (DTH-09A)

STATUS=OPERATIONS_CANDIDATE  
LIVE_UPLOAD_AUTHORIZED=NO

## Hosting contract

- Public website: Checkdomain static FTP/SFTP (`host275.checkdomain.de`)
- Lead API: Vercel project `deintarifheld-leads-api` (`https://deintarifheld-leads-api.vercel.app`)
- Build: `npm run build:static:production` with `NEXT_PUBLIC_LEADS_API_ORIGIN` required

## Merge before upload

`LIVE_BUILD_SOURCE_BRANCH=main`  
`MERGE_BEFORE_PUBLIC_UPLOAD=YES`  
`DEPLOYED_SHA_MUST_EQUAL_REMOTE_MAIN=YES`

Do not upload an unmerged feature branch. Merge the cutover candidate to `main` first, then build from that SHA.

## Scripts

```bash
npm run build:static:production
npm run verify:static:production
npm run cutover:plan
bash scripts/deploy/checkdomain/dth-checkdomain.sh plan
bash scripts/deploy/checkdomain/dth-checkdomain.sh backup   # dry-run
bash scripts/deploy/checkdomain/dth-checkdomain.sh upload   # dry-run; --apply later
bash scripts/deploy/checkdomain/dth-checkdomain.sh rollback # dry-run
```

Credentials: `infra/checkdomain/config.env` (gitignored, mode `0600`). Prefer SSH key (`CHECKDOMAIN_SSH_IDENTITY`). Never pass passwords on argv.

## Partial upload protection

- No remote wipe before upload
- Stage under `releases/<timestamp>/` when applying
- Promote `_next`/images first, HTML last
- Rollback restores the previous local backup tree via SFTP

## Mail gate

Default: `ALLOW_MOCK_MAIL_CUTOVER=NO`. While `LEADS_MAIL_MODE=mock`, upload `--apply` is blocked unless an explicit ops order sets `ALLOW_MOCK_MAIL_CUTOVER=YES`.
