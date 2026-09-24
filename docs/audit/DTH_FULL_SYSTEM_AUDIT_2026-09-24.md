# DTH Full-System Senior Audit — 2026-09-24

Status: ACTIVE  
Baseline: `main@501000a40a93c622421af88f0619c7bb828b6b1d`  
Working branch: `audit/dth-senior-cleanup-2026-09-24`  
Production mutation: NONE

## Audit contract

This audit treats the current production behavior as a locked baseline. Changes are made only on the audit branch, in reviewable waves. Production and `main` remain untouched until the relevant tests, static build checks, CI and controlled production verification pass.

Primary goals:

1. No false success in forms.
2. No reCAPTCHA regression or silent bypass.
3. No lead loss when storage/mail/upstream providers partially fail.
4. No duplicate or obsolete deployment paths.
5. No stale documentation that can cause an operator to deploy the wrong architecture.
6. Minimal runtime/dependency surface.
7. Reproducible build/deploy/rollback.
8. Clear separation between client UX helpers and server security enforcement.
9. Fail-closed security configuration without accidental denial-of-service from malformed environment values.
10. Clean observability without secrets or customer PII in logs.

## Current architecture confirmed

Public site:
- Next.js static export
- Checkdomain serves the public site
- Canonical host: `https://www.deintarifheld.de`

Lead backend:
- Vercel Next.js API
- `/api/leads/`
- `/api/careers/`
- Supabase persistence
- Resend mail
- Enterprise reCAPTCHA Assessment
- exact-origin CORS
- distributed Supabase rate limiting

Production mail evidence currently established:
- lead storage and the form/API path were proven
- internal Resend notification was proven Delivered after removing the stale recipient suppression
- production was then switched to `LEADS_MAIL_MODE=live` with `ALLOW_CUSTOMER_MAIL=YES` and redeployed
- a final two-message E2E proof (internal + customer confirmation for the same fresh lead) is still required before this audit records customer confirmation as production-verified

## Findings confirmed so far

### A-01 — P0/P1: malformed reCAPTCHA score configuration can bypass the score threshold

File: `lib/leads/captcha.js`

Current code uses:

```js
const min = Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_MIN_SCORE)
if (risk.score < min) ...
```

If `RECAPTCHA_MIN_SCORE` is a non-numeric string, `Number(...)` becomes `NaN`. Comparisons against `NaN` are false, so a valid Google token could pass without an effective minimum-score check.

Required remediation:
- parse and validate the configured threshold
- permit only a documented range
- fail closed or use an explicit safe default
- regression test malformed, out-of-range and normal values

### A-02 — P1: Resend transport exceptions can escape after the lead has already been stored

File: `lib/leads/mail.js`

The code handles Resend responses that contain `error`, but provider/network exceptions are not caught around `resend.emails.send()`.

Impact:
- lead can be inserted successfully
- provider call can throw
- route can terminate with 500 before mail metadata/audit is written
- the user may retry while the stored lead already exists
- operator state can become ambiguous

Required remediation:
- provider wrapper that never throws through the intake route
- structured transport failure
- preserve lead success while accurately recording mail failure
- add offline regression test for thrown network/provider exception

### A-03 — P1: mail state loses partial-success detail

File: `lib/leads/mail.js`

In live mode the internal message is sent first. If the customer confirmation then fails, the function returns a generic failed state even though the internal notification already succeeded.

Required remediation:
- retain partial state in returned/audited metadata
- never resend the internal mail unintentionally on an automatic retry
- preserve provider IDs for reconciliation

Schema change is not required for the first safe wave; audit metadata can carry the extra detail before any DB expansion is considered.

### A-04 — P1: static deploy rollback does not explicitly restore hidden `.htaccess`

File: `scripts/deploy/checkdomain/dth-checkdomain.sh`

Rollback currently uses a wildcard upload:
`put -r *`

Shell/SFTP wildcard behavior does not include dotfiles in the same way as ordinary visible files. The production security/routing file is `.htaccess`.

Required remediation:
- restore `.htaccess` explicitly
- verify its hash/header behavior after rollback

### A-05 — P1: deployment script claims staged/assets-first promotion but promotion is not actually from the staging release

The upload function creates `releases/<timestamp>` and uploads a staged copy, but the promotion step uploads again directly from the local `out` directory. The staged release is not the source of promotion.

Additionally the final `put -r *` weakens the documented “HTML last” contract because it can re-upload both assets and HTML after the explicit ordered operations.

Required remediation:
- make deployment contract match implementation
- either promote from a staged remote release atomically/semantically, or simplify honestly
- enforce a deterministic order
- no remote wipe before verified replacement

### A-06 — P1: backup manifest generation is self-referential/racy

The manifest file is created by shell redirection in the same directory that is simultaneously scanned by `find`.

Required remediation:
- generate manifest to a temporary path outside the backup tree
- move it into place only after hashing completes
- verify manifest against backup

### A-07 — P1: old VS Code deployment tasks bypass the controlled deployment path

File: `.vscode/tasks.json`

The tracked tasks include:
- machine-specific absolute paths
- direct rsync to production
- `StrictHostKeyChecking=no`
- duplicated build tasks
- direct upload path that bypasses backup/mail gate/verification

This contradicts the current controlled deployment tooling.

Required remediation:
- replace tasks with repository-relative safe commands
- remove direct production rsync tasks
- never disable host-key verification
- production write remains explicit CLI operation outside a one-click editor shortcut

### A-08 — P2: machine-specific and obsolete root scripts remain tracked

Candidates confirmed:
- `build-check.sh`
- `upload.sh`
- `upload-ftp.sh`
- `test-backend.mjs`
- `package-lock.json.old`
- `app/datenschutz/page.js.bak`
- empty `DEINTARIFHELD`
- root `NEU TARI.jpg` duplicate candidate

These increase operator ambiguity and maintenance surface.

Deletion requires a final reference/asset-hash check before removal.

### A-09 — P1/P2: stale reCAPTCHA/GAS documentation describes an architecture that is no longer production

Confirmed stale root documents:
- `INTEGRATION_SUMMARY.md`
- `RECAPTCHA_SETUP.md`
- `RECAPTCHA_QUICKSTART.md`
- `google-apps-script.js` remains in the current tree although production is Vercel/Supabase/Enterprise Assessment

Some of these documents instruct an operator to configure/deploy Google Apps Script or legacy reCAPTCHA secrets. That is now operationally dangerous.

Required remediation:
- current README/runbook becomes source of truth
- historical incident/audit evidence is clearly marked historical or moved under history
- no active root-level instructions for the retired architecture

### A-10 — P2: README is still create-next-app boilerplate

The README does not explain the real production architecture, test gates, deploy path, rollback path, environment contract or “do not deploy legacy GAS” rule.

Required remediation:
- replace with concise current architecture/runbook index

### A-11 — P2: unused direct dependency `motion-dom`

No application import was found. `framer-motion` is used and may bring `motion-dom` transitively, but the direct package declaration appears unnecessary.

Required remediation:
- remove direct dependency only with lockfile-consistent install and CI/audit pass

### A-12 — P2: client timing security code is dead/inconsistent with the current design

`lib/leads/abuse-guard.js` retains timing functions, but the brittle server-side “<3 seconds = bot” rejection was intentionally removed in PR #15 because it could reject legitimate users and create false-success behavior.

Current forms still transport `_formLoadedAt`, while server security no longer relies on it.

Required remediation:
- do not reintroduce the brittle timing gate
- remove dead timing security claims/code in a dedicated cleanup wave, or explicitly redefine it as non-blocking telemetry

### A-13 — P2: route/helper duplication increases drift risk

`app/api/leads/route.js` and `app/api/careers/route.js` duplicate:
- request-id handling
- JSON response helpers
- idempotency patterns
- mail response normalization
- error response patterns

Required remediation:
- extract only stable shared primitives
- keep channel-specific business logic readable

### A-14 — P1/P2: arbitrary incoming `x-request-id` is trusted/reflected

Current helpers accept an inbound request ID without an explicit length/character bound and echo it into response/body.

Required remediation:
- canonical bounded request-id parser
- generate a server ID when invalid
- no client PII/secrets in request ID

### A-15 — P2: external provider calls do not have explicit application-level timeouts

Confirmed for:
- Google Enterprise Assessment
- Resend

Required remediation:
- bounded timeouts
- fail closed for captcha
- structured mail failure for Resend
- no hanging form request indefinitely

### A-16 — P2: browser lead POST has no explicit timeout

`lib/leads/browser-api.js` can wait indefinitely on a stalled network/API request.

Required remediation:
- bounded client timeout with clear retry-safe UI
- preserve idempotency semantics
- do not blindly resend side-effecting requests

### A-17 — P2: retention environment numbers are not centrally validated

`app/api/cron/retention/route.js` uses `Number(env)` directly. Malformed values can become `NaN` and later produce invalid date calculations.

Required remediation:
- validated bounded integer configuration
- fail closed with an explicit configuration error
- test invalid values

### A-18 — P2: server Supabase URL accepts a `NEXT_PUBLIC_` fallback

`getServiceSupabase()` accepts `NEXT_PUBLIC_SUPABASE_URL` before `SUPABASE_URL`.

The URL itself is not secret, but the naming encourages mixing client/server configuration.

Required remediation:
- migrate server runtime toward `SUPABASE_URL`
- keep transition backward compatible until production env is confirmed

### A-19 — P2: public metadata/content claims need a factual audit

Examples currently embedded in metadata/JSON-LD/public page include numeric savings, customer/review counts and aggregate rating.

This audit will verify each externally checkable claim or remove/qualify unsupported structured-data claims. No marketing number should exist only because it was historically hardcoded.

### A-20 — P2: accessibility focus styling needs a systematic pass

Static search found multiple `outline: none` usages. Some may have replacement focus styles; each interactive element must be checked before any change.

## Controls already strong — preserve them

Do not regress these:

- server-side Enterprise Assessment
- server-owned captcha action expectation
- exact hostname validation
- strict origin/referrer intake gate
- bounded JSON body stream
- distributed production rate limit
- production fail-closed rate-limit backend
- RLS with service-role-only data access
- separate admin vs cron secrets
- timing-safe secret comparison
- HttpOnly/SameSite admin session
- public health routes do not expose mail mode/secrets
- storage-first lead semantics
- explicit 403 honeypot behavior
- route-level duplicate/idempotency protections
- static output secret/legacy-backend scanner
- deploy never starts with a remote wipe

## Work waves

### Wave 1 — correctness/resilience
- reCAPTCHA config parser + timeout
- Resend exception/timeout handling
- request ID normalization
- retention config validation
- regression tests

### Wave 2 — deploy/rollback integrity
- staged deployment contract
- `.htaccess` rollback
- backup manifest correctness
- production hash verification
- remove unsafe editor deployment shortcuts

### Wave 3 — form/frontend cleanup
- browser timeout/retry semantics
- remove dead timing-security code
- consolidate stable form helpers
- accessibility/focus
- no reCAPTCHA lifecycle regression

### Wave 4 — repository/dependency hygiene
- delete proven-unused legacy files
- stale GAS/reCAPTCHA docs cleanup
- accurate README/runbooks
- direct dependency cleanup
- generated/backup file policy

### Wave 5 — performance/SEO/content
- image weight and duplicates
- route duplication (`/unternehmen` vs `/unternehmen-neu`)
- sitemap/canonical consistency
- metadata/JSON-LD factual validation
- client JS/motion cost

### Wave 6 — final release gate
- lint
- build
- static build
- static production verifier
- all lead/security/mail/privacy tests
- npm audit policy
- CI
- read-only production parity
- one controlled E2E only after explicit release approval

## Release rule

No merge and no production change just because a cleanup “looks better”. Every runtime/deployment change needs a regression proof tied to the failure mode it fixes.
