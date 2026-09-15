# Production environment matrix (names only)

```
PRODUCTION_ENV_MATRIX_READY=YES
PRODUCTION_ENV_VERIFIED=PARTIAL
```

Human verified 2026-09-15 that the named production slots below marked `YES`
are **PRESENT**. **No values are printed.** Optional/unlisted slots stay UNKNOWN.

`MUST_BE_SECRET=YES` means the value must never appear in tickets, PR bodies, CI logs, or chat.

| Name | REQUIRED/OPTIONAL | MUST_BE_SECRET | PRODUCTION_EXPECTED_VALUE_TYPE | VERIFIED_PRESENT |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | REQUIRED | NO (URL) | `https://<project-ref>.supabase.co` | YES (`NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | REQUIRED | YES | service-role JWT | YES |
| `RECAPTCHA_SECRET_KEY` | REQUIRED | YES | classic siteverify secret | YES |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | OPTIONAL (v2) | NO | standard v2 site key | UNKNOWN (v2 not the selected production variant) |
| `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` | OPTIONAL (v3) | NO | standard v3 site key | YES |
| `RECAPTCHA_ALLOWED_HOSTNAMES` | OPTIONAL | NO | host allowlist; defaults include `deintarifheld.de` / `www` | UNKNOWN |
| `RECAPTCHA_MIN_SCORE` | OPTIONAL | NO | number, default 0.5 | UNKNOWN |
| `LEADS_ADMIN_SECRET` | REQUIRED | YES | ≥32 chars; production fail-closed if weak | YES |
| `CRON_SECRET` | REQUIRED | YES | ≥32 chars; must differ from admin | YES |
| `LEADS_RATE_LIMIT_SALT` | REQUIRED | YES | unpredictable; not historic default | YES |
| `AUDIT_EMAIL_HASH_SALT` | REQUIRED | YES | unpredictable; **must differ** from rate-limit salt | YES |
| `LEADS_ALLOWED_ORIGINS` | OPTIONAL (defaults exist) | NO | exact origins; localhost stripped in production | YES (intended `https://deintarifheld.de,https://www.deintarifheld.de`) |
| `LEADS_RATE_LIMIT_PROVIDER` | OPTIONAL | NO | production default `supabase` when `VERCEL_ENV=production` | UNKNOWN |
| `LEADS_ALLOW_MEMORY_RATE_LIMIT` | OPTIONAL | NO | must **not** be `YES` in production | UNKNOWN |
| `LEADS_MAIL_MODE` | REQUIRED | NO | intended `internal_live`; not `live` for cutover | YES (intended `internal_live`) |
| `ALLOW_CUSTOMER_MAIL` | REQUIRED | NO | **`NO`** (unset treated as closed) | YES (intended `NO`) |
| `LEADS_TO_EMAIL` | REQUIRED for live/internal_live | NO | ops recipients (e.g. `kontakt@deintarifheld.de`) | YES (intended `kontakt@deintarifheld.de`) |
| `LEADS_FROM_EMAIL` | REQUIRED for live/internal_live | NO | verified sender identity | YES (intended `DeinTarifheld <kontakt@deintarifheld.de>`) |
| `RESEND_API_KEY` | REQUIRED for live/internal_live | YES | Resend key | YES |
| `NEXT_PUBLIC_LEADS_API_ORIGIN` | REQUIRED for Checkdomain static | NO | `https://deintarifheld-leads-api.vercel.app` | UNKNOWN on the **build host**; live Datenschutz already names this origin |
| `LEADS_ALLOW_SMOKE_BYPASS` | OPTIONAL | NO | must be unset/`NO` in production (code ignores it in production anyway) | UNKNOWN |
| `LEADS_INTAKE_SMOKE_SECRET` | OPTIONAL | YES | unused in production runtime | UNKNOWN |
| `LEADS_RUNTIME_ENV` | OPTIONAL | NO | `production` only if forcing fail-closed off-Vercel | UNKNOWN |
| `VERCEL_ENV` | platform | NO | `production` on the production API deployment | UNKNOWN |
| `LEADS_RETENTION_DAYS` / `LEADS_PRIVATE_RETENTION_DAYS` / `LEADS_CAREER_RETENTION_DAYS` | OPTIONAL | NO | operational defaults 90 / 90 / 183 | UNKNOWN |

## Binding production constraints (code)

- `ALLOW_CUSTOMER_MAIL` must stay `NO`. Customer mail requires **both** `LEADS_MAIL_MODE=live` **and** `ALLOW_CUSTOMER_MAIL=YES` (`customerMailDualGuardOpen`).
- Smoke bypass is hard-disabled when `isProductionRuntime()` (`VERCEL_ENV=production` or `LEADS_RUNTIME_ENV=production`).
- Production origin allowlist **drops localhost** even if listed in `LEADS_ALLOWED_ORIGINS`.
- Production rate-limit defaults to `supabase`. Memory mode in production is denied unless `LEADS_ALLOW_MEMORY_RATE_LIMIT=YES` (must not be set).
- Missing captcha secret fail-closes in production.

Human/Vercel must fill `VERIFIED_PRESENT` without pasting values.
