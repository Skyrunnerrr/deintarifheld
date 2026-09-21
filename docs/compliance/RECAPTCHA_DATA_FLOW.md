# reCAPTCHA data flow (technical)

```
CAPTCHA_PRODUCTION_VARIANT=enterprise_v3_assessment
CAPTCHA_PROVIDER_CONSISTENT=YES
LEGAL_REVIEW_REQUIRED=YES
```

This is a **technical** description of what the software does. It is **not** a privacy policy, legal basis, or transfer assessment. Repo `/datenschutz` §9.4 discloses this flow. Qualified legal review remains required.

## Chosen production variant

**reCAPTCHA v3 execute** via Google **Enterprise Assessment** (Custom Integration). Single production path.

- Site key: `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY`
- Server credentials: `RECAPTCHA_PROJECT_ID` + `RECAPTCHA_API_KEY` (server-only)
- Browser script: `https://www.google.com/recaptcha/enterprise.js?render=<SITE_KEY>`
- Verify URL: `https://recaptchaenterprise.googleapis.com/v1/projects/{PROJECT_ID}/assessments?key={API_KEY}`
- Hostname check against `deintarifheld.de` / `www.deintarifheld.de` (plus optional `RECAPTCHA_ALLOWED_HOSTNAMES`)
- `tokenProperties.action` must exactly match the **server-owned** expected action; `riskAnalysis.score` must meet `RECAPTCHA_MIN_SCORE`
- `RECAPTCHA_SECRET_KEY` is **not** load-bearing for this verification path
- `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is ignored (same site key as `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY`)
- Visible v2 (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`) must stay unset in production
- Client `_recaptchaAction` is telemetry only and does not set the server expectation

## Flow

```
Browser (form)
  → Google reCAPTCHA enterprise.js + grecaptcha.enterprise.execute (fresh token on submit)
  → Token in POST body (`_recaptchaToken`)
  → DTH API (`/api/leads/` or `/api/careers/`)
  → Google Enterprise Assessment (token + siteKey + expectedAction [+ IP/UA when known])
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
| IP address | Browser → Google; optionally `userIpAddress` on Assessment | Yes, when the request IP is known and not `unknown` |
| User-Agent | Browser → Google; optionally `userAgent` on Assessment; hashed with IP for DTH rate-limit key | Yes, when present on the request |
| reCAPTCHA token | Browser → DTH → Google | Yes |
| Timestamp | Google `createTime`; DTH request time | Decision time only |
| Action name | v3 token / `tokenProperties.action` | Yes, exact match vs server expectation |
| Provider | Google reCAPTCHA Enterprise Assessment | Yes |
| Hostname | `tokenProperties.hostname` | Yes, allowlist |
| Score | `riskAnalysis.score` | Yes, threshold |

Privacy-policy alignment, legal basis, and third-country wording: **LEGAL_REVIEW_REQUIRED=YES**.
