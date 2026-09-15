# reCAPTCHA data flow (technical)

```
CAPTCHA_PRODUCTION_VARIANT=standard_v2_v3_siteverify
CAPTCHA_PROVIDER_CONSISTENT=YES
LEGAL_REVIEW_REQUIRED=YES
```

This is a **technical** description of what the software does. It is **not** a privacy policy, legal basis, or transfer assessment. Repo `/datenschutz` §9.4 now discloses this flow. Qualified legal review remains required.

## Chosen production variant

**Standard reCAPTCHA v2 checkbox and/or v3 execute**, verified with Google **classic siteverify**.

- Site key: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (v2) and/or `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` (v3)
- Server secret: `RECAPTCHA_SECRET_KEY`
- Verify URL: `https://www.google.com/recaptcha/api/siteverify`
- Hostname check against `deintarifheld.de` / `www.deintarifheld.de` (plus optional `RECAPTCHA_ALLOWED_HOSTNAMES`)
- v3: `data.action` must exactly match the **server-owned** expected action; `data.score` must meet `RECAPTCHA_MIN_SCORE`
- `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is **not** a supported production variant
- Enterprise tokens must **not** be sold through classic siteverify
- Client `_recaptchaAction` is telemetry only and does not set the server expectation

## Flow

```
Browser (form)
  → Google reCAPTCHA (script + token mint)
  → Token in POST body (`_recaptchaToken`)
  → DTH API (`/api/leads/` or `/api/careers/`)
  → Google classic siteverify (secret + token [+ remoteip when known])
  → Decision (allow / captcha-rejected)
```

Expected action is derived only from server context:

| Context | page_source / endpoint | Google v3 action (no hyphens) |
|---|---|---|
| business | `unternehmen` or empty on `/api/leads/` | `unternehmen` |
| private | `hero-funnel` | `hero_funnel` |
| private | `main_funnel` | `main_funnel` |
| private | `privat` | allowlist `hero_funnel` \| `main_funnel` (no form action named privat) |
| career | `/api/careers/` | `career` |

Google v3 actions must match `/^[A-Za-z0-9/_]+$/`. `page_source=hero-funnel` is unchanged.

## Possible data involved (technical)

| Item | Where it may appear | Used by DTH? |
|---|---|---|
| IP address | Browser → Google; optionally `remoteip` on siteverify | Yes, when the request IP is known and not `unknown` |
| User-Agent | Browser → Google (Google-side); hashed with IP for DTH rate-limit key | UA is not sent to siteverify |
| reCAPTCHA token | Browser → DTH → Google | Yes |
| Timestamp | Google `challenge_ts`; DTH request time | Decision time only |
| Action name | v3 token / siteverify `data.action` | Yes, exact match vs server expectation |
| Provider | Google reCAPTCHA Standard | Yes |
| Hostname | siteverify `hostname` | Yes, allowlist |
| Score | siteverify `score` (v3) | Yes, threshold |

Privacy-policy alignment, legal basis, and third-country wording: **LEGAL_REVIEW_REQUIRED=YES**.
