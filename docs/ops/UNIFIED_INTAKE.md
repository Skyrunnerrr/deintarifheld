# Unified intake

One public form (`UnifiedInquiryForm`) posts to `POST /api/leads/`. The server owns `inquiry_type` routing, the reCAPTCHA action `inquiry`, storage, and internal mail. The browser does not choose handlers, recipients, or the expected captcha action.

## Types

| `inquiry_type` | UI | Storage | Internal subject |
| --- | --- | --- | --- |
| `private_energy` | Strom/Gas privat | `leads.page_source=privat` | Privatanfrage |
| `business_energy` | Strom/Gas Gewerbe | `leads.page_source=unternehmen` | Gewerbeanfrage |
| `partner` | Partner / Zusammenarbeit | `career_applications` | Partneranfrage |
| `general` | Allgemeine Anfrage | `leads.page_source=general` | allgemeine Anfrage |

Pages may pass `initialType`. `/kontakt/` leaves it unset. Old page sources (`hero-funnel`, `main_funnel`, `unternehmen`, `/api/careers`) stay on the API for already deployed clients. New pages do not call them.

## Request path

1. Browser validates fields, then mints one Enterprise v3 token with `CAPTCHA_ACTION_INQUIRY` immediately before POST.
2. `POST /api/leads/` with `page_source=inquiry`, `Idempotency-Key`, and `_recaptchaToken` attached after sanitizing user fields.
3. Intake guard: content type, CORS allowlist, rate limit, body cap (12 KiB), Enterprise Assessment. Expected action comes from `page_source`, never from `_recaptchaAction`.
4. Strict schema. Unknown, oversized, control-character, or file fields are rejected. Honeypot hits are blocked and not stored.
5. Insert the lead (or partner row) first.
6. Send one internal email. Customer mail is never sent for inquiry types, including when `LEADS_MAIL_MODE=live` and `ALLOW_CUSTOMER_MAIL=YES`.
7. Success UI only when HTTP 200, `ok`, `stored`, and `mail` are true and `mailStatus` is `accepted` or `internal_sent`. Stored inquiry success is `mail_status=internal_sent`.

Mail failure keeps the row, sets `mail_status=failed`, and returns HTTP 202 with `ok: false`. A repeat submit with the same idempotency key does not send again and does not create a second row. The cron worker owns the single automatic retry.

## Environment

Names only. Do not print values.

- `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY`, `RECAPTCHA_PROJECT_ID`, `RECAPTCHA_API_KEY`, `RECAPTCHA_MIN_SCORE`
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `LEADS_FROM_EMAIL`, `LEADS_TO_EMAIL`, `LEADS_MAIL_MODE=internal_live`
- `ALLOW_CUSTOMER_MAIL=NO`
- `LEADS_ALLOWED_ORIGINS` (exact origins; production does not allow localhost)
- `LEADS_ADMIN_SECRET` for admin routes only. It does not authorize cron.
- `CRON_SECRET` for `/api/cron/retention` and `/api/cron/inquiry-mail` (`Authorization: Bearer` or `x-cron-secret`). Never a query parameter.

Public health is `GET /api/leads/` and does not include mail mode or secrets.

## Mail, captcha, headers

- Captcha is Enterprise Assessment only (`recaptchaenterprise.googleapis.com`). Legacy siteverify is not used.
- From is the authenticated `LEADS_FROM_EMAIL` (display-name form allowed). Recipients are bare addresses from `LEADS_TO_EMAIL`. Reply-To is the validated submitter address only. CR/LF is stripped from subjects.
- SPF, DKIM, and DMARC are assumed on the From domain in Resend. This change does not edit DNS. Confirm the domain in the Resend dashboard before relying on deliverability.
- API responses set HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, and `Content-Security-Policy: default-src 'none'`.
- The static site CSP allows the specific reCAPTCHA hosts `https://www.google.com`, `https://www.gstatic.com`, and `https://www.recaptcha.net` (no host wildcards). `unsafe-inline` remains because the marketing pages use inline styles.

## Automatic mail retry

`GET /api/cron/inquiry-mail` runs on the existing Vercel cron. Schedule in `vercel.json` is `15 4 * * *` (04:15 UTC, once per day). That matches the Hobby daily-cron limit already used by retention (`crons[0]` stays `/api/cron/retention` at `0 3 * * *`). A sub-daily expression such as `*/15 * * * *` fails a Hobby deploy. On Pro, the one-time faster schedule is to change only the inquiry-mail entry to `*/15 * * * *`.

Selection: `mail_status=failed`, `status` not `deleted`, payload `inquiry_type` is a real unified type, and `updated_at` is at least 2 minutes old. Partner rows are read from `career_applications`. Successful (`internal_sent` / `accepted`) and `failed_final` rows are not selected.

The worker claims with `UPDATE … SET mail_status='retrying' WHERE mail_status='failed'`. Only the claimer sends. Success stores `internal_sent`. Failure stores `failed_final` and emits one error log. A later run does not send again. A row left in `retrying` because the process died after the claim is not reclaimed, so a crash cannot double-send. The inbox shows that status.

Auth is `isCronAuthorized` (`CRON_SECRET` only). `POST` is 405. `LEADS_ADMIN_SECRET`, a missing secret, and `?secret=` do not run the worker. The handler does not log the secret.

## Failure visibility and alerting

Initial failure logs `inquiry.mail_failed`. The terminal retry logs exactly:

`inquiry.mail_failed_final` with `leadRef`, `inquiryType`, `storage` (`leads` or `career`), and `code` (`mail-send-failed`, `mail-not-configured`, `mail-mode-unsupported`, or `mail-status-unknown`). No email, body, captcha token, or API key.

The ops inbox (`public/ops/inbox.js`) shows `internal_sent`, `failed`, `retrying`, and `failed_final` as distinct labels. The existing “Nur Mail fehlgeschlagen” filter includes `failed`, `retrying`, and `failed_final`.

Vercel built-in alerts (Settings → Alerts → Error Anomaly) do not match this event. They watch 5xx spikes. Submit mail failure is HTTP 202, and the cron returns 200 after it has stored `failed_final`.

One-time setup, no new alerting code:

1. Open the Vercel project that serves this API in production.
2. Confirm Production `CRON_SECRET` is set. Vercel Cron sends `Authorization: Bearer`. Do not put the secret in the path or query.
3. Project → Settings → Log Drains → Add Drain. Source: Functions. Environment: Production.
4. Alert criterion: a log line containing `"event":"inquiry.mail_failed_final"`.
5. Destination: the team's existing Slack channel or email webhook. If the drain form cannot filter, filter that exact event string at the destination. The line has only the four fields above.

After that drain is on, `failed_final` does not depend on a daily inbox check. Log Drains are a Vercel plan feature (not available on every Hobby team). There is no in-repo substitute that pages someone when Resend itself is down.

## Monitoring and rollback

Other actionable logs: `inquiry.mail_failed`, `inquiry.insert_failed`, `inquiry.mail_recovery_failed`, `intake.captcha_rejected`, `intake.honeypot_blocked`. They omit tokens and message bodies.

Rollback of this reliability change is redeploy of `a4b000963a411a193a18a85fc8ebfdd59c86d9ed`. No database migration. `mail_status` is unconstrained text (`failed`, `retrying`, `failed_final`, `internal_sent`).

## Production E2E (after deploy, one per type)

Do not run against production from an unattended agent. After the API deployment:

1. Submit one real inquiry per type on the production site (private, business, partner, general).
2. Confirm the success screen, one inbox row, and one internal mail with the subject above. Confirm no customer mail.
3. Repeat the same click: no second row and no second mail.
4. Negative checks: empty required field, captcha blocked (devtools offline before submit), and API unavailable. The form must show an error and must not show success.

Customer mail stays off.
