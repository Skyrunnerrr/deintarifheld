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
6. Send one internal email. Customer mail is never sent for inquiry types.
7. Success UI only when HTTP 200, `ok`, `stored`, and `mail` are true and `mailStatus` is `accepted` or `internal_sent`.

Mail failure keeps the row, sets `mail_status=failed`, and returns HTTP 202 with `ok: false`. The same idempotency key retries that mail once. A second row is not created. A successful mail is not sent again.

## Environment

Names only. Do not print values.

- `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY`, `RECAPTCHA_PROJECT_ID`, `RECAPTCHA_API_KEY`, `RECAPTCHA_MIN_SCORE`
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `LEADS_FROM_EMAIL`, `LEADS_TO_EMAIL`, `LEADS_MAIL_MODE=internal_live`
- `ALLOW_CUSTOMER_MAIL=NO`
- `LEADS_ALLOWED_ORIGINS` (exact origins; production does not allow localhost)
- `LEADS_ADMIN_SECRET` for admin routes; cron uses its own auth

Public health is `GET /api/leads/` and does not include mail mode or secrets.

## Mail, captcha, headers

- Captcha is Enterprise Assessment only (`recaptchaenterprise.googleapis.com`). Legacy siteverify is not used.
- From is the authenticated `LEADS_FROM_EMAIL` (display-name form allowed). Recipients are bare addresses from `LEADS_TO_EMAIL`. Reply-To is the validated submitter address only. CR/LF is stripped from subjects.
- SPF, DKIM, and DMARC are assumed on the From domain in Resend. This change does not edit DNS. Confirm the domain in the Resend dashboard before relying on deliverability.
- API responses set HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, and `Content-Security-Policy: default-src 'none'`.
- The static site CSP allows the specific reCAPTCHA hosts `https://www.google.com`, `https://www.gstatic.com`, and `https://www.recaptcha.net` (no host wildcards). `unsafe-inline` remains because the marketing pages use inline styles.

## Monitoring and rollback

Actionable failures are structured logs: `inquiry.mail_failed`, `inquiry.insert_failed`, `intake.captcha_rejected`, `intake.honeypot_blocked`. They omit tokens and message bodies. Vercel logs and the admin inbox (failed-mail filter) are the alert surface. There is no new paging service.

Rollback is redeploy of baseline `501000a40a93c622421af88f0619c7bb828b6b1d` (or the previous Vercel deployment). No new database migration. New rows use existing tables.

## Production E2E (after deploy, one per type)

Do not run against production from an unattended agent. After the API deployment:

1. Submit one real inquiry per type on the production site (private, business, partner, general).
2. Confirm the success screen, one inbox row, and one internal mail with the subject above. Confirm no customer mail.
3. Repeat the same click: no second row and no second mail.
4. Negative checks: empty required field, captcha blocked (devtools offline before submit), and API unavailable. The form must show an error and must not show success.

Customer mail stays off.
