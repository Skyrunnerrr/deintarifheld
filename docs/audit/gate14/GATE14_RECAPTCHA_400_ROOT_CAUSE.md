# GATE 14 — reCAPTCHA HTTP 400 root-cause audit

```
GATE=14
SCOPE=READ_ONLY_ROOT_CAUSE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_CONFIG_CHANGED=NO
CHECKDOMAIN_CHANGED=NO
RECAPTCHA_KEYS_ROTATED=NO
```

This gate isolates the current reCAPTCHA HTTP 400 blocker **before** any real E2E submit.
It does **not** implement Gate 15.

Numbering note: `docs/deployment/PR6_DEPLOY_ORDER.md` still labels an older
“GATE14 Internal Resend mail verify”. This document is the **recaptcha-400
root-cause** gate requested for the current production blocker. It does not
authorize mail, admin, DB, or Checkdomain work.

---

## Required status block

```
SOURCE_SHA=8f8755a21b35822adf357d59cc3384782910c99a
PRODUCTION_BASELINE_STABLE=YES
RECAPTCHA_VERSION=standard_v3_execute + classic siteverify (v2 checkbox path present in code, unused on live Checkdomain)
CLIENT_TOKEN_PATH=components/ui/RecaptchaBox.jsx → lib/security.js getRecaptchaToken() → window.grecaptcha.execute(NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY, {action})
SERVER_VERIFY_PATH=app/api/leads|careers POST → lib/leads/intake-guard.js enforcePublicIntake() → lib/leads/captcha.js verifyCaptchaToken() → https://www.google.com/recaptcha/api/siteverify
KEY_CONFIGURATION=DIVERGED. Checkdomain live bundle PUBLIC_KEY=6LdCwGst… is rejected by Google api.js (HTTP 400). Vercel frontend bundle PUBLIC_KEY=6LdE67Es… is accepted (HTTP 200). RECAPTCHA_SECRET_KEY PRESENT on production API per 2026-09-15 matrix (value not re-read). v2 SITE_KEY not inlined on live static.
DOMAIN_CONFIGURATION=Apex deintarifheld.de 301→www.deintarifheld.de VERIFIED. Server hostname allowlist defaults deintarifheld.de + www. Google console domain list NOT_ASSESSABLE. DOMAIN_MISMATCH not assigned: the 400 reproduces for the Checkdomain key even with Referer https://www.deintarifheld.de/; the Vercel key returns 200 under the same conditions.
CLIENT_SERVER_CONTRACT=MATCH on field _recaptchaToken (JSON). _recaptchaAction is telemetry only. Content-Type application/json. Captcha failures are HTTP 403, not 400.
ROOT_CAUSE=RC01+RC13. The Checkdomain production static build inlines an invalid/unusable NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY (6LdCwGstAAAAAO_0-R3NTXSFWuMzbSd9MGjVZaPZ). Browser load of https://www.google.com/recaptcha/api.js?render=<that-key> returns Google HTTP 400 ("malformed / should not be retried"). RecaptchaBox therefore never mints a token. This is Google's script 400, not a DTH /api/leads POST 400. The Vercel frontend still ships the older working site key 6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS (api.js HTTP 200). DTH captcha verify maps all captcha codes to 403.
CONFIDENCE=HIGH
PRODUCTION_POST_EXECUTED=NO
E2E_EXECUTED=NO
MAIL_SENT=NO
DB_WRITE_EXECUTED=NO
ENV_CHANGED=NO
MINIMUM_FIX=On the Checkdomain static build host, set NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY to a Google-accepted v3 site key that pairs with the live RECAPTCHA_SECRET_KEY (the Vercel-shipped 6LdE67Es… key already returns api.js 200). Rebuild STATIC_EXPORT and publish. Do not rotate the secret unless pairing is proven wrong. No product/runtime code change is required to clear this 400.
GATE15_READY=YES
ENDSTATUS=GATE14_ROOT_CAUSE_CONFIRMED
```

Public site keys above are **client-public** (`6L…`). No secret values are printed.

---

## 1. Locked production state (read-only)

Audited repo tip:

| Field | Value | Evidence |
|---|---|---|
| `SOURCE_SHA` | `8f8755a21b35822adf357d59cc3384782910c99a` | `git rev-parse HEAD` = `origin/main` after `git fetch origin main` |
| Commit | `[DTH] Phase 2 P0 – Production hardening (PR #6) (#6)` | `git log -1` |
| Working tree at audit start | clean | `git status` |

Production probes **GET only**. No POST. No admin login. No token sent to `/api/leads` or `/api/careers`.

| Probe | Result | Evidence (2026-09-18 UTC) |
|---|---|---|
| Production API host | `https://deintarifheld-leads-api.vercel.app` — Vercel `server: Vercel`, region `iad1` | Response headers |
| Vercel deploy SHA | NOT_ASSESSABLE | No git SHA in `x-vercel-id` / HTML. Frontend build id `0xa39CAhlUmdYl9NgpAih` ≠ Checkdomain `cZsIQpdr5W7762LghIHPy` |
| `LEADS_GET` | **200** `{"ok":true,"service":"dth-leads","phase":"B","supported":["unternehmen","privat","hero-funnel","main_funnel"],"careerEndpoint":"/api/careers"}` | GET `/api/leads/` |
| `CAREERS_GET` | **200** `{"ok":true,"service":"dth-careers","phase":"B","supported":["career"],"fileUploads":false}` | GET `/api/careers/` |
| Public GET mail fields | ABSENT | `lib/leads/public-health.js` L1–20; live JSON has no `mailMode` / `ALLOW_CUSTOMER_MAIL` |
| `ADMIN_UNAUTH` | **401** HTML login shell `Anfragen-Eingang` | GET `/api/admin/inbox/` |
| `ADMIN_AUTH` | NOT_ASSESSABLE this pass | Secret not used. Claimed “auth admin works” not re-proven |
| `LEADS_MAIL_MODE` | NOT_ASSESSABLE from live GET. Docs: intended `internal_live` PRESENT 2026-09-15 | `docs/deployment/PRODUCTION_ENV_MATRIX.md` L37 |
| `ALLOW_CUSTOMER_MAIL` | NOT_ASSESSABLE from live GET. Docs: intended `NO` PRESENT 2026-09-15 | same matrix L38 |
| `CUSTOMER_MAIL_ENABLED` | Code fail-closed unless `live` **and** `YES` | `docs/audit/PHASE2_P0_DECISIONS.md` L50–51 |
| Checkdomain www | **200** nginx, `Last-Modified: Thu, 17 Sep 2026 18:03:28 GMT` | GET `https://www.deintarifheld.de/` |
| Apex | **301** → `https://www.deintarifheld.de/` | GET `https://deintarifheld.de/` no-follow |
| Live legal `/datenschutz/` | **200**, last-modified 2026-09-17, names Standard v3 + siteverify + Vercel API URLs | GET; prior “LIVE_SITE_LEGAL_TEXT=STALE” (2026-09-15 docs) is outdated vs this GET |
| Live homepage security headers | No CSP / HSTS on the HTML response | Contrast repo `public/.htaccess` L24–32. Not the 400 cause |
| `FORM_POST_EXECUTED` | **NO** | This gate |
| `E2E_EXECUTED` | **NO** | This gate |

Claimed prior baseline, re-verified where allowed:

| Claim | This pass |
|---|---|
| Admin secret live | NOT_ASSESSABLE (no secret read). Unauth 401 implies **some** gate is live |
| Unauth admin → 401 | **VERIFIED** |
| Auth admin works | NOT_ASSESSABLE |
| GET `/api/leads/` and `/api/careers/` respond | **VERIFIED** 200 |
| Customer mails disabled | Code + 2026-09-15 matrix; live value NOT_ASSESSABLE from GET |
| No real form submit yet | **UNCHANGED** by this gate |

`PRODUCTION_BASELINE_STABLE=YES` — this gate did not write production, DB, mail, env, Checkdomain, or keys.

---

## 2. reCAPTCHA architecture map

**Chosen production variant (code + live legal text):** Standard reCAPTCHA **v3 execute**, verified with Google **classic siteverify**.
Enterprise is disabled. v2 checkbox exists in code but is not the live Checkdomain path.

`CAPTCHA_PRODUCTION_VARIANT=standard_v2_v3_siteverify` (`lib/leads/captcha-action.js` L27).

| Piece | Implementation | Version | Evidence |
|---|---|---|---|
| Library / SDK | Official `api.js` + `window.grecaptcha`. No npm recaptcha package. No `enterprise.js` | v3 execute on live Checkdomain | `lib/security.js` L119–177; live chunk `91-031d3bf89ddd81c6.js` |
| v2 checkbox | `api.js?render=explicit` + `grecaptcha.render` if `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is truthy | v2, unused live | `lib/security.js` L201–294; `RecaptchaBox.jsx` L30–56 |
| Enterprise | Hard-disabled | not supported | `lib/security.js` L179–197; tests `P0_CAPTCHA_PROVIDER=PASS` |
| Client site key (v3) | `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` | public | `.env.example` L27; inlined in client bundles |
| Client site key (v2) | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | public | `.env.example` L26 |
| Server secret | `RECAPTCHA_SECRET_KEY` | secret | `lib/leads/captcha.js` L10–16 |
| Optional score | `RECAPTCHA_MIN_SCORE` default `0.5` | v3 | `captcha.js` L7, L109–110 |
| Optional extra hosts | `RECAPTCHA_ALLOWED_HOSTNAMES` (comma list) + defaults | both | `captcha.js` L8, L27–32 |
| Token mint | `grecaptcha.execute(publicKey, { action })` | v3 | `lib/security.js` L168–171 |
| Token refresh | 90s interval | v3 tokens ~2 min | `RecaptchaBox.jsx` L65–68 |
| Token transport | JSON field `_recaptchaToken` via `postJsonLead` | — | forms + `lib/leads/browser-api.js` L84–93 |
| Telemetry only | `_recaptchaAction` **must not** set server expectation | — | `intake-guard.js` L70–74; `captcha-action.js` L4–6 |
| Server verify URL | `https://www.google.com/recaptcha/api/siteverify` POST `application/x-www-form-urlencoded` (`secret`, `response`, optional `remoteip`) | classic | `captcha.js` L6, L71–82 |
| Hostname check | Allowlist; production rejects missing hostname | both | `captcha.js` L121–127 |
| Score / action | v3 only, when Google returns `score` or `action` | v3 | `captcha.js` L35–37, L105–118 |
| Timeout / expiry | Client refresh 90s. Server does **not** parse `challenge_ts` | v3 | `RecaptchaBox.jsx` L65–68; `captcha.js` has no age check |
| Error mapping | see §3 / §8 | — | `intake-guard.js` L66–78 |
| Routes that require captcha | `POST /api/leads/`, `POST /api/careers/` when secret present **or** production runtime | — | `captcha.js` L22–25; `intake-guard.js` L58–79 |
| Routes that do not | GET health, admin, cron, OPTIONS | — | `app/api/leads/route.js` L84–86; careers GET L69–71 |

### Key classification (values never printed for secrets)

| Name | Scope | Classification this pass |
|---|---|---|
| `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` on **Checkdomain live static** (2026-09-17) | Browser | **PRESENT / INVALID-FOR-V3-RENDER** — inlined `6LdCwGstAAAAAO_0-R3NTXSFWuMzbSd9MGjVZaPZ`; Google `api.js?render=` → **400** |
| `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` on **Vercel frontend** | Browser | **PRESENT / GOOGLE-ACCEPTED** — inlined `6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS`; Google `api.js?render=` → **200** `application/javascript` |
| `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` on production **API env** | Build-time for that Next app | PRESENT per 2026-09-15 matrix; Vercel HTML still ships the accepted key |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` live static | Browser | **MISSING** in the bundle (`hasVisibleRecaptchaSiteKey` remains `!!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, not inlined) |
| `RECAPTCHA_SECRET_KEY` production API | Server | **PRESENT** (human matrix 2026-09-15). Value **NOT_ASSESSABLE** this pass |
| `RECAPTCHA_MIN_SCORE` / `RECAPTCHA_ALLOWED_HOSTNAMES` | Server | UNKNOWN / NOT_ASSESSABLE |
| `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` | — | Not a supported variant; helpers always empty/false |

`hasStandardV3SiteKey()` is compiled to `return !0` on live Checkdomain (`function E(){return!0}`), so RecaptchaBox **always** takes the v3 path and hits the bad `api.js?render=` URL.

---

## 3. Trace the 400 without submitting

### 3.1 Where DTH emits HTTP 400 on intake (not captcha)

| Location | Condition | Status | Captcha? |
|---|---|---|---|
| `lib/leads/intake-guard.js` L23–24 | `Content-Type` not JSON | 400 `invalid-content-type` | No |
| `lib/leads/read-json-body.js` L18, L41, L46, L51 | empty / unreadable / non-JSON body | 400 `invalid-payload` | No |
| `lib/leads/intake-guard.js` L53–55 | body not an object | 400 `invalid-payload` | No |
| `app/api/leads/route.js` L96–98 | schema fail **after** captcha | 400 (`privacy-required`, `invalid-name-email`, …) | No — captcha already passed |
| `app/api/careers/route.js` L81–83 | same | 400 | No |

### 3.2 Where captcha fails — **403, never 400**

| Code | Condition | HTTP | File |
|---|---|---|---|
| `captcha-action-unknown-context` | unknown `page_source` / endpoint | **403** | `intake-guard.js` L66–68 |
| `captcha-not-configured` | production, no secret | **403** | `captcha.js` L59–60 → intake L76–78 |
| `captcha-invalid` | token not a string, or length &lt; 20 or &gt; 4000 | **403** | `captcha.js` L62–63 |
| `captcha-verify-failed` | fetch throw, Google `!res.ok`, bad JSON | **403** | `captcha.js` L67–68, L83–88, L94–95 |
| `captcha-rejected` | `success !== true`, low score, missing/mismatch action, bad/missing hostname | **403** | `captcha.js` L98–127 |

Unit proof (mocked, no Google, no DB): `scripts/leads-p0-security-test.mjs` L134–142 — missing token → `captcha-invalid` **status 403**.

**Therefore:** a DTH `/api/leads` or `/api/careers` response cannot be a captcha-verify HTTP 400. If someone recorded “API 400 + captcha”, they either saw a **schema/content-type** 400 or misread Google’s script 400 as the API.

### 3.3 The actual HTTP 400 (verified, no form POST)

Live Checkdomain client (`/_next/static/chunks/91-031d3bf89ddd81c6.js`) sets:

```
https://www.google.com/recaptcha/api.js?render=6LdCwGstAAAAAO_0-R3NTXSFWuMzbSd9MGjVZaPZ
```

Read-only GETs of that URL (this cloud IP, with and without browser UA + `Referer: https://www.deintarifheld.de/`, both `www.google.com` and `www.recaptcha.net`):

```
HTTP/2 400
content-type: text/html
```

Google HTML: *“400. That’s an error. The server cannot process the request because it is malformed. It should not be retried.”*

Controls from the same environment:

| URL | HTTP | Type |
|---|---|---|
| `api.js?render=6LdCwGstAAAAAO_0-R3NTXSFWuMzbSd9MGjVZaPZ` (Checkdomain key) | **400** | `text/html` |
| `api.js?render=6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS` (Vercel / docs key) | **200** | `text/javascript` |
| Google documented test key `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI` | **200** | `text/javascript` |
| `api.js` (no render) | **200** | `text/javascript` |
| `api.js?render=explicit` | **200** | `text/javascript` |
| `api.js?render=` (empty) | **200** | `text/javascript` |

No lead POST, no siteverify POST, no mail, no DB.

Client consequence (code): `loadRecaptcha()` `script.onerror` / missing `grecaptcha` → `getRecaptchaToken()` returns `null` → RecaptchaBox shows *“Captcha konnte nicht geladen werden”* (`RecaptchaBox.jsx` L71–73). Forms refuse submit without a token (`Hero.jsx` L209–211 and siblings). The lead API is never reached.

### REQUEST FLOW

```
Browser
  → Form (Hero / Funnel / Unternehmen / Career)
  → RecaptchaBox(action = hero_funnel | main_funnel | unternehmen | career)
  → Token generation (v3 execute)
  → JSON POST postJsonLead(leadsApiUrl()|careersApiUrl())
  → API route
  → Content-Type + JSON body
  → Origin/Referer
  → Rate limit
  → resolveExpectedCaptchaAction(endpoint, page_source)
  → siteverify + hostname/action/score
  → schema validate
  → lead handling (storage/mail)   ← NOT ENTERED in this gate
```

| Stage | Status | Notes |
|---|---|---|
| Browser → Form | VERIFIED | Live HTML 2026-09-17; RecaptchaBox in shipped JS |
| Token generation | VERIFIED FAIL | Google `api.js?render=<Checkdomain key>` HTTP 400 |
| Request payload | VERIFIED (code) / NOT_ASSESSABLE (live POST) | Contract `_recaptchaToken` + JSON |
| API route reached on live submit | NOT_ASSESSABLE | No POST. Unreachable until token mints |
| Schema validation | VERIFIED (code) | 400 only after captcha |
| Captcha verification | VERIFIED (code + mocked tests) | 403 on failure |
| Domain/action/score | VERIFIED (code) / NOT_ASSESSABLE (live Google response) | No siteverify call made |
| Lead handling | NOT_ASSESSABLE | Forbidden this gate |

---

## 4. Client / server contract

No assumed aliases. Cited names only.

| Side | Field / header | File |
|---|---|---|
| Client send | `_recaptchaToken` | `Hero.jsx` L223; `FunnelSection.jsx` L199; `BusinessForm.jsx` L154; `CareerSection.jsx` L84; `app/unternehmen/page.js` L132 |
| Client telemetry | `_recaptchaAction` = `hero_funnel` / `main_funnel` / `unternehmen` / `career` | same files |
| Client `page_source` | `hero-funnel` / `main_funnel` / `unternehmen` / `career` | same files |
| Transport | `POST` JSON `Content-Type: application/json` + `Idempotency-Key` | `lib/leads/browser-api.js` L84–93 |
| Server read token | `raw._recaptchaToken` string only | `intake-guard.js` L60 |
| Server expected action | from endpoint + `page_source` only | `captcha-action.js` L45–81 |
| Server ignores | `_recaptchaAction` as expectation | `intake-guard.js` L70 |
| Not used | `recaptchaToken`, `captchaToken`, `token`, `g-recaptcha-response` | no matches on intake path |
| CORS allow headers | `Content-Type, Idempotency-Key` | `lib/leads/cors.js` L25 |
| Origin | production browser POST needs allowlisted Origin or Referer | `abuse-guard.js` L40–56 |
| CSRF cookie | none | — |

**CLIENT_SERVER_CONTRACT=MATCH** for field names, JSON, and actions on all four product forms.
Default `RecaptchaBox` / `getRecaptchaToken` action `'submit'` is unused by product forms.

Consent field names (not captcha, but 400-after-captcha if wrong): private/career send `gdpr`; business sends `dsgvo`. Validators accept `gdpr` | `dsgvo` | `privacyAccepted` (`validate-private.js` L70; `validate-unternehmen.js` L80; `validate-career.js` L65).

---

## 5. Production env check (read-only)

No Vercel dashboard token. No env values printed.

| Question | Result |
|---|---|
| Platform dashboard access | NOT_ASSESSABLE |
| `RECAPTCHA_SECRET_KEY` on API | PRESENT (matrix 2026-09-15); this pass NOT_ASSESSABLE |
| `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` on API/Vercel build | PRESENT — Vercel frontend inlines the **accepted** key |
| Same name on Checkdomain **build host** | PRESENT in shipped JS, but **INVALID** for `api.js?render=` |
| `DEPLOYMENT_INCLUDES_ENV` | PARTIAL: Vercel app includes a working public key; Checkdomain static includes a different, rejected key |
| `NEXT_PUBLIC_LEADS_API_ORIGIN` on live Checkdomain | PRESENT in bundle: `https://deintarifheld-leads-api.vercel.app` (`c91.js`) |

---

## 6. Domain / hostname

No Checkdomain changes.

| Fact | Evidence | Verdict |
|---|---|---|
| Canonical public host | www; apex 301 → www | VERIFIED |
| Server allowlist defaults | `deintarifheld.de`, `www.deintarifheld.de` | `captcha.js` L8 |
| Vercel app host | `deintarifheld-leads-api.vercel.app` also serves the Next frontend | GET `/` 200 |
| Vercel host in captcha allowlist | **No** (unless `RECAPTCHA_ALLOWED_HOSTNAMES` adds it — UNKNOWN) | Forms on the Vercel hostname would fail hostname after a token minted — not today’s 400 |
| Google console domains | NOT_ASSESSABLE | No console access |
| `DOMAIN_MISMATCH` | **Not assigned** | 400 is key-specific; working key + same www Referer → 200 |

---

## 7. Version-specific (do not mix)

**Live Checkdomain = v3 execute only.**

| v3 item | Code / live | Status |
|---|---|---|
| Action names | `unternehmen`, `career`, `hero_funnel`, `main_funnel` (no hyphens) | VERIFIED; `page_source=hero-funnel` ≠ Google action |
| Score | default 0.5 | VERIFIED code; live threshold UNKNOWN |
| Hostname | allowlist + production missing-hostname reject | VERIFIED code |
| Token age | not checked server-side; 90s client refresh | VERIFIED code |
| `grecaptcha.ready()` before execute | **Not used** on v3 path | `lib/security.js` L128–134 vs Google docs. Secondary (RC13 hygiene). Not the 400 — script never loads |
| v2 challenge lifecycle | N/A on live Checkdomain | SITE_KEY missing in bundle |
| Token reuse / reset | v3 refresh 90s; v2 `resetVisibleRecaptcha` unused live | — |

Vercel frontend still v3-execute with the **accepted** key. A submit **from the Vercel origin** would still face origin allowlist (403 `request-blocked`) and hostname allowlist — out of scope for this 400.

---

## 8. Error-path classification

Codes assigned only with evidence. Multiple allowed.

| Code | Meaning | Assigned? | Evidence |
|---|---|---|---|
| **RC01** | Client site key missing / malformed / rejected by Google `api.js` | **YES** | Checkdomain key → Google 400; Vercel key → 200 |
| RC02 | Server secret missing | NO | Matrix PRESENT; production would 403 `captcha-not-configured`, not Google 400 |
| RC03 | Site/secret pair mismatch | NOT_ASSESSABLE | No siteverify. Keys **diverged** across hosts — pair must be checked in Gate 15 without printing values |
| RC04 | Domain / hostname mismatch | NO | Same Referer; only the Checkdomain key 400s |
| RC05 | v3 action mismatch | NO | Product actions match server map; token never minted |
| RC06 | Score below threshold | NO | No siteverify |
| RC07 | Token missing/invalid at API | N/A for this 400 | Would be DTH **403** `captcha-invalid` if POST happened without token |
| RC08 | Token expiry / reuse | NO | Script never loads |
| RC09 | Version mix (v2/v3/Enterprise) | POSSIBLE, not proven | Rejected key could be v2/deleted/wrong-type; cannot see Google console |
| RC10 | Field-name contract mismatch | NO | `_recaptchaToken` matches |
| RC11 | Content-Type / CORS | NO for this 400 | Would be DTH 400 `invalid-content-type` or 403 `request-blocked` |
| RC12 | siteverify HTTP failure | NO | siteverify not called |
| **RC13** | Client token generation blocked | **YES** | `api.js` 400 → no `grecaptcha` → null token |
| **RC14** | HTTP 400 misattributed to DTH captcha verify | **YES** (clarifying) | DTH captcha path is 403. Observed 400 is Google `api.js` |

`UNKNOWN` is not required. Primary pair: **RC01 + RC13**.

---

## 9. Static / unit only

Ran locally after `npm ci` (no production network except the GET probes in §1 / §3.3):

```
P0_CAPTCHA=PASS
P0_CAPTCHA_SERVER_ACTION=PASS
P0_CAPTCHA_PROVIDER=PASS
P0_SECURITY_TESTS=PASS
P0_REMEDIATION_TESTS=PASS
CONTRACT_TESTS=PASS
BROWSER_API_CONTRACT_TEST=PASS
FORM_REQUEST_INTERCEPTION=PASS
RECAPTCHA_V3_ACTIONS=PASS
P0_CLOSURE_TESTS=PASS
REAL_CUSTOMER_MAIL_SENT=NO
PRODUCTION_DATA_MUTATED=NO
```

Scripts: `leads-p0-security-test.mjs`, `leads-p0-remediation-test.mjs`, `leads-contract-test.mjs`, `browser-api-contract-test.mjs`, `form-request-intercept-test.mjs`, `leads-p0-closure-test.mjs`.

Not run: `leads-smoke.mjs` and any production POST. `scripts/leads-smoke.mjs` would POST a lead (refuses production targets via `refuseProductionTarget`).

---

## 10. Minimum fix (DEFINE ONLY — not implemented)

```
ROOT_CAUSE=RC01+RC13 Checkdomain-inlined NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY is rejected by Google classic api.js (HTTP 400). Vercel still ships a Google-accepted v3 site key.
MINIMUM_FIX=1) On Checkdomain static build host only, set NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY to a v3 site key that returns HTTP 200 from api.js?render=KEY (the Vercel-shipped 6LdE67Es… key already does). 2) Confirm RECAPTCHA_SECRET_KEY on the production API is the matching secret for that site key (names only; do not print). 3) Rebuild STATIC_EXPORT from SOURCE_SHA (or later approved SHA) and publish Checkdomain. 4) Re-GET api.js?render=<new-inlined-key> from www.deintarifheld.de context and expect 200 text/javascript. 5) Do not POST a lead in Gate 15 unless a separate E2E order exists — Gate 15 stops when the script loads and grecaptcha.execute can mint (optional: DevTools only).
FILES_AFFECTED=Checkdomain build env + static rebuild/publish. No required edits under app/ or lib/. This audit is docs-only. Optional later hygiene (NOT required to clear the 400): wrap v3 execute in grecaptcha.ready() in lib/security.js.
ENV_CHANGE_REQUIRED=YES (Checkdomain build-time NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY). API secret change only if pairing is wrong.
GOOGLE_CONSOLE_CHANGE_REQUIRED=NO unless ops cannot find a working v3 key already bound to www.deintarifheld.de / deintarifheld.de. Do not rotate keys unless the accepted key’s domains are wrong.
REDEPLOY_REQUIRED=YES (static rebuild + Checkdomain publish). Vercel API redeploy not required for this 400 if the API secret already pairs with the restored public key.
REGRESSION_RISK=LOW if the restored public key is the one already accepted by Google and already paired on the API. MEDIUM if a new key is created and the secret is not updated in lockstep (would flip the blocker from Google 400 to DTH 403 captcha-rejected).
TEST_PLAN=1) GET api.js?render=<inlined live key> → 200 JS. 2) Open www.deintarifheld.de, open a form, confirm RecaptchaBox has no load error and a token string is present in memory (DevTools). 3) Replay mocked unit tests (already green). 4) Do not production-POST unless Gate 13/E2E is separately authorized.
ROLLBACK_PLAN=Keep the previous Checkdomain static tree (GATE11 backup path). Revert only the public key / static files. Do not remove RECAPTCHA_SECRET_KEY (fail-closes intake). Do not enable customer mail.
```

---

## 11. Gate 15 definition (tiny — captcha blocker only)

`GATE15_READY=YES` because the 400 is isolated to the Checkdomain-inlined public key.

**In scope**

1. Correct `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` on the Checkdomain static **build** host (or confirm the Vercel-accepted key is used).
2. Rebuild + publish static only.
3. Read-only proof: `api.js?render=<live inlined key>` is 200; RecaptchaBox no longer shows the load error.
4. Ops check (no value print): API `RECAPTCHA_SECRET_KEY` pairs with that site key.

**Out of scope**

- Product/UI refactor, mail, admin, DB, migrations, Checkdomain DNS, key rotation unless pairing is proven broken, E2E lead POST, customer mail, CSP/header polish, `grecaptcha.ready()` unless a second failure remains after the key is fixed.

**Exit**

```
GATE15_PASS=
  GOOGLE_APIJS_RENDER=200
  CLIENT_TOKEN_MINTED=YES (in-browser, no API POST required)
  DTH_PRODUCTION_POST=NO unless a later gate authorizes it
  MAIL_SENT=NO
  DB_WRITE=NO
```

Do not start Gate 15 from this PR.

---

## 12. Evidence index

| Item | Location |
|---|---|
| Repo SHA | `8f8755a21b35822adf357d59cc3384782910c99a` |
| Client v3 load/execute | `lib/security.js` L119–177 |
| RecaptchaBox | `components/ui/RecaptchaBox.jsx` |
| Server verify | `lib/leads/captcha.js` |
| Action binding | `lib/leads/captcha-action.js` |
| 403 mapping | `lib/leads/intake-guard.js` L58–78 |
| 400 mapping (non-captcha) | `intake-guard.js` L23–24; `read-json-body.js`; route schema 400s |
| Env names | `.env.example` L24–30; `PRODUCTION_ENV_MATRIX.md` L24–28 |
| Live Checkdomain key (public) | `/_next/static/chunks/91-031d3bf89ddd81c6.js` |
| Live Vercel key (public) | `/_next/static/chunks/91-537133029fe61b6e.js` |
| Unit proofs | §9 |

---

## Final machine block (repeat)

```
SOURCE_SHA=8f8755a21b35822adf357d59cc3384782910c99a
PRODUCTION_BASELINE_STABLE=YES
RECAPTCHA_VERSION=standard_v3_execute + classic siteverify
CLIENT_TOKEN_PATH=RecaptchaBox.jsx → lib/security.js#getRecaptchaToken → grecaptcha.execute
SERVER_VERIFY_PATH=intake-guard.js → captcha.js#verifyCaptchaToken → google.com/recaptcha/api/siteverify
KEY_CONFIGURATION=DIVERGED_CHECKDOMAIN_INVALID_VERCEL_ACCEPTED
DOMAIN_CONFIGURATION=WWW_CANONICAL_VERIFIED; DOMAIN_MISMATCH=NO
CLIENT_SERVER_CONTRACT=MATCH(_recaptchaToken JSON)
ROOT_CAUSE=RC01+RC13 Checkdomain public key rejected by Google api.js HTTP 400
CONFIDENCE=HIGH
PRODUCTION_POST_EXECUTED=NO
E2E_EXECUTED=NO
MAIL_SENT=NO
DB_WRITE_EXECUTED=NO
ENV_CHANGED=NO
MINIMUM_FIX=Restore a Google-accepted v3 PUBLIC_KEY on Checkdomain static build; rebuild+publish; confirm secret pairing; no runtime code required
GATE15_READY=YES
ENDSTATUS=GATE14_ROOT_CAUSE_CONFIRMED
```
