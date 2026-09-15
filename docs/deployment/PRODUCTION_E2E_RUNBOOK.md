# Production E2E runbook (next step after P0)

STATUS=NOT_AUTHORIZED_FROM_PR6  
PRODUCTION_E2E_READY=NO  
LIVE_LEAD_SUBMITTED=NO  
This document describes the next real end-to-end test. It does **not** authorize submitting a live lead from CI or from this PR.

## Path under test

Checkdomain public site (`https://www.deintarifheld.de`)  
→ private / business / career lead form  
→ `POST https://deintarifheld-leads-api.vercel.app/api/leads/` or `/api/careers/`  
→ server validation (origin, captcha, body cap, timing, rate limit)  
→ Supabase `leads` / `career_applications`  
→ internal Resend mail (`LEADS_MAIL_MODE=internal_live`)  
→ `kontakt@deintarifheld.de` (and any extra `LEADS_TO_EMAIL` ops addresses)  
→ Ops Inbox `https://deintarifheld-leads-api.vercel.app/api/admin/inbox/`  
→ stored `mail_status` / `mail_mode` truth

Customer confirmation must stay off.

## Env checks before the test (values never printed)

Confirm on Vercel (production), do not paste secrets into tickets, chat, or CI logs:

| Name | Required value | Notes |
|---|---|---|
| `VERCEL_ENV` | `production` (platform) | Enables fail-closed controls |
| `LEADS_MAIL_MODE` | `internal_live` | Not `live` |
| `ALLOW_CUSTOMER_MAIL` | unset or `NO` | Dual guard |
| `RESEND_API_KEY` | set | Never print |
| `LEADS_FROM_EMAIL` | verified sender | |
| `LEADS_TO_EMAIL` | includes `kontakt@deintarifheld.de` | |
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | set | |
| `SUPABASE_SERVICE_ROLE_KEY` | set | Never print |
| `RECAPTCHA_SECRET_KEY` | set | Production fail-closed without it |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and/or `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` | Standard v2/v3 only | Enterprise site key is not supported |
| `LEADS_ADMIN_SECRET` | ≥ 32 chars | Never print; inbox cookie only |
| `CRON_SECRET` | ≥ 32 chars, different from admin | Never print |
| `LEADS_RATE_LIMIT_SALT` | unpredictable, not the old default | |
| `LEADS_RATE_LIMIT_PROVIDER` | `supabase` (default in production) | Apply `003` + `004` + `005` (`consume_rate_limit` INVOKER) first |
| `AUDIT_EMAIL_HASH_SALT` | unpredictable, not the rate-limit salt | Delete-audit HMAC only |
| `LEADS_ALLOWED_ORIGINS` | public site origins only | localhost ignored in production |
| `LEADS_ALLOW_SMOKE_BYPASS` | unset / `NO` | Must stay off in production |
| `NEXT_PUBLIC_LEADS_API_ORIGIN` | `https://deintarifheld-leads-api.vercel.app` | Static Checkdomain build |

Do **not** print: admin/cron/smoke/recaptcha secrets, service role, Resend key, session cookies.

## How to run (ops, not CI)

1. Confirm Checkdomain HTML is built from the merged SHA that contains this P0 (`npm run build:static:production` after merge).
2. Confirm Vercel production has the env table above.
3. Confirm migrations `003_leads_rate_limits.sql`, `004_consume_rate_limit.sql`, and `005_legal_hold_and_rate_limit_invoker.sql` are applied (additive). Do not run destructive SQL. Order: DB → env verify → Production API → Checkdomain static → controlled E2E (`docs/deployment/PR6_DEPLOY_ORDER.md`).
4. Open the public form in a normal browser (not curl). Complete captcha.
5. Use a **synthetic** address that you control (`*@example.invalid` is wrong for a real Resend inbox; use an internal mailbox that is not a customer).
6. Submit once.
7. Expect: 2xx JSON with `ok: true`, `mailMode` not required on public GET; POST may show `mailMode: internal_live`, `customerConfirmation: skipped`.
8. Confirm row in Supabase (ops only).
9. Confirm one internal mail at `kontakt@deintarifheld.de`.
10. Open ops inbox with the admin secret (password form → HttpOnly cookie). Confirm the same lead and mail status.
11. Confirm no mail was sent to the form email.

Do not use `scripts/leads-smoke*.mjs` against production unless `ALLOW_PRODUCTION_SMOKE=YES` is set **by a human for that shell only**. CI must never set it.

## PASS

- Browser POST from `https://www.deintarifheld.de` accepted.
- Captcha verified server-side (invalid token → 403, no row).
- Supabase row created with truthful `mail_status` (`internal_sent` or `failed`).
- Exactly one internal ops mail; customer confirmation count = 0.
- Inbox shows the lead only after auth.
- Public GET `/api/leads/` has no `mailModeDefault`.

## FAIL

- 403 `request-blocked` from the real site (origin allowlist wrong).
- 403 `captcha-*` with a completed widget (secret/site-key mismatch).
- 429 immediately (rate-limit backend missing or salt unset).
- 500 `storage-not-configured`.
- Customer received a confirmation.
- Inbox HTML visible without login.
- GET health leaks mail mode or env names.

## Rollback

1. Set `LEADS_MAIL_MODE=mock` on Vercel (stops provider mail; intake can remain up).
2. If intake is abusive: remove `RECAPTCHA_SECRET_KEY` is **wrong** (production then fail-closes). Instead disable the Vercel deployment or set an emergency allowlist miss.
3. Static site: redeploy previous Checkdomain release via existing rollback script (`dth-checkdomain.sh rollback`).
4. Do not drop Supabase tables. Do not run `npm audit fix` as rollback.

## Secrets that must never be printed

`RECAPTCHA_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `LEADS_ADMIN_SECRET`, `CRON_SECRET`, `LEADS_INTAKE_SMOKE_SECRET`, `LEADS_RATE_LIMIT_SALT`, inbox session cookie `dth_admin`.
