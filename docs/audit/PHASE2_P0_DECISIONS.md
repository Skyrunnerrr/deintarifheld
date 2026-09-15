# Phase 2 P0 — conservative decisions

Binding ticket: GitHub Issue #5. Legal copy for F-14 / F-15 / F-16 is **not** invented here.

## Runtime

- Production is `VERCEL_ENV=production` or `LEADS_RUNTIME_ENV=production`.
- `NODE_ENV=production` is ignored (set by `next build` / CI).

## Captcha (F-04 / F-22)

- Server verifies `_recaptchaToken` against Google `siteverify` when `RECAPTCHA_SECRET_KEY` is set.
- Production without that secret fail-closes (`captcha-not-configured`).
- Private / business / career share `enforcePublicIntake`.
- `BusinessForm` now sends the same token fields as the other channels.
- LEGAL_REVIEW_REQUIRED for Google as processor / third country remains open (F-14 / F-16).

## Origin (F-04 / F-05)

- Missing Origin **and** Referer is untrusted.
- Production allowlist is the public site origins plus `LEADS_ALLOWED_ORIGINS`, with localhost / 127.0.0.1 stripped.
- CI/smoke bypass: header `x-dth-intake-smoke` + `LEADS_INTAKE_SMOKE_SECRET` + `LEADS_ALLOW_SMOKE_BYPASS=YES`. Disabled in production even if those env vars are set.

## Body / timing

- Body is read from the stream with a 12288-byte hard cap. `Content-Length` is only an early reject.
- `_formLoadedAt` is enforced: missing, invalid, &lt; 3s, or &gt; 6h → bot accept (`ok: true, bot: true`). Not treated as a no-op.

## Rate limit (F-04)

- Provider: `memory` (local/CI) or `supabase` (production default).
- Production memory use requires explicit `LEADS_ALLOW_MEMORY_RATE_LIMIT=YES`.
- Supabase errors fail-closed in production, memory-fallback otherwise.
- Required production env: `LEADS_RATE_LIMIT_SALT`, Supabase URL + service role, additive migration `003_leads_rate_limits.sql`.
- No new SaaS. No committed secrets.

## Admin / cron (F-01 / F-02)

- `crypto.timingSafeEqual` after length-safe buffer handling.
- Production secrets &lt; 32 chars or denylisted → treated as missing (deny all).
- Admin brute-force: 5 / 10 min / IP via the same provider.
- Inbox HTML is 401 without session/Bearer. Login POST sets HttpOnly `dth_admin` cookie (30 min, SameSite=Strict, Path=/api/admin).
- No sessionStorage / localStorage / query secret.
- `LEADS_ADMIN_SECRET` never authorizes cron; `CRON_SECRET` never authorizes admin.

## Mail (F-10)

- Customer mail only if `LEADS_MAIL_MODE=live` **and** `ALLOW_CUSTOMER_MAIL=YES`.
- `internal_live` never sends customer mail.
- Unknown modes fail-closed (`mail-mode-unsupported`).
- Public GET no longer echoes `mailModeDefault`.

## Headers (F-19)

- Vercel API: HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, tight default CSP; inbox CSP tighter.
- Checkdomain `.htaccess`: HSTS + CSP allowing self, inline styles/scripts already used, reCAPTCHA, ProvenExpert, Vercel Lead API.

## Dependencies (F-21 / F-25)

- Remove unused `axios`.
- Next.js 15.5.14 → 15.5.24 (same minor, August 2026 security release).
- `npm audit` is report-only in CI. No `npm audit fix`.

## Out of scope (unchanged)

- No Averion.
- No autonomous customer communication.
- No new CRM.
- No invented legal/privacy copy.
- Soft-delete / F-11 remains P1.
- LEGAL_REVIEW_REQUIRED: F-14, F-15, F-16 (and F-10 before `live` customer mail).
