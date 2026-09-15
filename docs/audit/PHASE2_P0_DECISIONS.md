# Phase 2 P0 — conservative decisions

Binding ticket: GitHub Issue #5. Legal copy for F-14 / F-15 / F-16 is **not** invented here.

## Runtime

- Production is `VERCEL_ENV=production` or `LEADS_RUNTIME_ENV=production`.
- `NODE_ENV=production` is ignored (set by `next build` / CI).

## Captcha (F-04 / F-22)

- Production variant: **Standard reCAPTCHA v2/v3 + classic siteverify only**.
- Enterprise frontend path is disabled. `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is not production-supported.
- Server derives expected action from endpoint + known `page_source`. Google v3 action for the hero form is `hero_funnel` (no hyphen). `page_source` stays `hero-funnel`. Client `_recaptchaAction` is telemetry only.
- v3: missing or mismatched `data.action` → reject. Score + hostname are enforced.
- Production without `RECAPTCHA_SECRET_KEY` fail-closes (`captcha-not-configured`).
- LEGAL_REVIEW_REQUIRED for Google as processor / third country remains open (see `docs/compliance/RECAPTCHA_DATA_FLOW.md`).

## Origin (F-04 / F-05)

- Missing Origin **and** Referer is untrusted.
- Production allowlist is the public site origins plus `LEADS_ALLOWED_ORIGINS`, with localhost / 127.0.0.1 stripped.
- CI/smoke bypass: header `x-dth-intake-smoke` + `LEADS_INTAKE_SMOKE_SECRET` + `LEADS_ALLOW_SMOKE_BYPASS=YES`. Disabled in production even if those env vars are set.

## Body / timing

- Body is read from the stream with a 12288-byte hard cap. `Content-Length` is only an early reject.
- `_formLoadedAt` is enforced: missing, invalid, &lt; 3s, or &gt; 6h → bot accept (`ok: true, bot: true`). Not treated as a no-op.

## Rate limit (F-04)

- Provider: `memory` (local/CI) or `supabase` (production default).
- Consume is atomic: memory increment+check has no await in the critical section; Postgres `consume_rate_limit(...)` is one SECURITY INVOKER RPC after `005` (service_role EXECUTE only; `search_path=pg_catalog, public, pg_temp`). Remote parallel proof stays UNKNOWN until a staging test (`docs/compliance/RATE_LIMIT_ATOMIC_REMOTE.md`).
- Production memory use requires explicit `LEADS_ALLOW_MEMORY_RATE_LIMIT=YES`.
- Supabase errors fail-closed in production, memory-fallback otherwise.
- Required production env: `LEADS_RATE_LIMIT_SALT`, Supabase URL + service role, migrations `003` + `004` + `005`. Never fail-open in production.
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

- Vercel API: HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, tight default CSP.
- Inbox CSP: `script-src 'self'; style-src 'self'` (static `/ops/inbox.js` + CSS). No `unsafe-inline`.
- Checkdomain `.htaccess`: HSTS + CSP allowing self, inline styles/scripts already used, reCAPTCHA, ProvenExpert, Vercel Lead API.

## Dependencies (F-21 / F-25)

- Remove unused `axios`.
- Next.js 15.5.14 → 15.5.24 (same minor, August 2026 security release).
- `npm audit` uses an assessed GHSA allowlist. Unknown new High/Critical fail CI. No `npm audit fix`. No Next 16.

## Out of scope (unchanged)

- No Averion.
- No autonomous customer communication.
- No new CRM.
- No invented legal/privacy copy.
- Soft-delete is **not** a legal hold. `legal_hold` is an explicit column, default false, never auto-set. Default erase/retention is redaction/minimisation. Delete audits use HMAC email, not plaintext.
- LEGAL_REVIEW_REQUIRED: F-14, F-15, F-16 (and F-10 before `live` customer mail). **Historical note (pre-alignment):** public texts were not rewritten in the earlier readiness pass. **2026-09-15:** repo `/datenschutz` and AGB were aligned to implemented behavior (`PUBLIC_LEGAL_ALIGNMENT=PASS`, `LEGAL_TEXT_CODE_MISMATCH=NO`). Qualified legal review is still required. Live Checkdomain pages were not republished (`LIVE_SITE_LEGAL_TEXT=STALE`).
- AI Act: no customer AI, no lead scoring, no career AI selection. Internal professional Cursor/cloud-agent use is recorded (`docs/compliance/AI_LITERACY_REGISTER.md`). `TRAINING=UNKNOWN`.
- Deploy: `003`/`004`/`005` independently verified PASS (do not rerun). Human-verified `VERCEL_GIT_CONNECTED=NO`, `AUTO_PRODUCTION_DEPLOY_ON_MAIN=NO`. `PR6_DEPLOYMENT_SAFE=NO` remains: merge is still not a cutover; Checkdomain legal publish and E2E stay separately authorized.
