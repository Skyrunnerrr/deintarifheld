# DeinTarifheld

Production repository for the DeinTarifheld public website and lead intake system.

## Production architecture

```text
Browser
  |
  | static website
  v
Checkdomain
  |
  | POST /api/leads/ or /api/careers/
  v
Vercel Next.js API
  |-- Enterprise reCAPTCHA Assessment
  |-- origin / payload / rate-limit validation
  |-- Supabase persistence + audit
  |-- Resend internal/customer mail
  v
Supabase
```

The public site is a Next.js static export hosted by Checkdomain. API routes run separately on the Vercel project `deintarifheld-leads-api`.

The retired Google Apps Script backend is not part of the production request path.

## Runtime invariants

- Production captcha verification uses Google reCAPTCHA Enterprise Assessment only.
- Captcha action and hostname are validated server-side.
- Production rate limiting uses Supabase and fails closed when its backend is unavailable.
- Leads are stored before mail delivery is attempted.
- Duplicate/idempotent requests must not create a second lead or resend mail.
- Admin and cron authentication use separate secrets.
- Public API responses must not expose secrets, provider configuration or raw customer data.
- Customer confirmation mail requires both `LEADS_MAIL_MODE=live` and `ALLOW_CUSTOMER_MAIL=YES`.
- Repository defaults stay safe for local/CI use. Do not commit production secrets.

## Local development

Node version:

```bash
nvm use
npm ci
npm run dev
```

Core verification:

```bash
npm run lint
npm run build
npm run phase-b:verify
npm run deps:audit
```

The GitHub Actions workflow runs the full contract/security/privacy suite on pull requests.

## Static production build

A production static build requires the API origin explicitly:

```bash
export NEXT_PUBLIC_LEADS_API_ORIGIN=https://deintarifheld-leads-api.vercel.app
npm run build:static:production
npm run verify:static:production
```

The verifier rejects legacy Google Apps Script endpoints, localhost endpoints, placeholders and known secret patterns in the generated static output.

## Checkdomain deployment

Use only the controlled deployment tooling:

```bash
npm run checkdomain:plan
npm run checkdomain:backup:dry
npm run checkdomain:upload:dry
npm run checkdomain:rollback:dry
```

Production writes require the explicit `--apply` form of `scripts/deploy/checkdomain/dth-checkdomain.sh`, valid local configuration, the mail gate, a verified backup and a deliberate release decision.

Do not use direct rsync/FTP editor shortcuts or legacy root upload scripts.

## Release sequence

1. Work on a branch.
2. Run local tests and build gates.
3. Open a pull request.
4. Require green CI.
5. Review runtime, security, legal/public-copy and deployment changes.
6. Merge to `main`.
7. Build the static site from the intended merged SHA.
8. Verify the static output.
9. Verify the Vercel API deployment/environment.
10. Back up Checkdomain.
11. Deploy using the controlled Checkdomain script.
12. Run read-only production parity checks.
13. Run a controlled end-to-end form test only when explicitly approved.
14. Keep rollback evidence until the release is accepted.

No feature branch is a production deployment source.

## Important directories

- `app/` Next.js pages and API routes
- `components/` public website UI
- `lib/leads/` lead intake, security, mail, persistence and operations logic
- `scripts/` tests, static build and operations tooling
- `supabase/migrations/` additive database migrations
- `docs/deployment/` deployment/runbook material
- `docs/compliance/` technical compliance evidence
- `docs/audit/` audit evidence and historical gate reports

Historical audit documents describe the state that existed at the date of the audit. They are evidence, not current operating instructions.

## Current audit workstream

The 2026-09-24 full-system review is tracked in:

`docs/audit/DTH_FULL_SYSTEM_AUDIT_2026-09-24.md`

The current operational release gate is:

`docs/deployment/CURRENT_PRODUCTION_RELEASE_GATE.md`

The review covers correctness, security, reCAPTCHA, mail, Supabase, retention, admin access, deployment/rollback, dependencies, repository hygiene, performance, accessibility, SEO and public claims.

## Secrets

Never commit or paste into issues/PRs:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RECAPTCHA_API_KEY`
- `LEADS_ADMIN_SECRET`
- `CRON_SECRET`
- `LEADS_RATE_LIMIT_SALT`
- deployment private keys/passwords

Use `.env.example` only as a variable-name contract. Production secret values belong in the relevant provider environment/configuration.
