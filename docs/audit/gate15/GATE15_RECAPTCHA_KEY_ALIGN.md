# GATE 15 — Checkdomain reCAPTCHA key align + static republish

```
GATE=15
SCOPE=RC01_RC13_ONLY
MODE=CONTROLLED_REMEDIATION
PRODUCT_CODE_CHANGED=NO
GOOGLE_SITEVERIFY_EXECUTED=NO
```

This gate was authorized to align the Checkdomain **static** `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY`
to the Google-accepted v3 public key already shipped by the Vercel frontend, then rebuild
and publish static only.

It **stopped before any env write, static rebuild, or Checkdomain publish** because this
agent host does not have Checkdomain static build-host / SFTP credentials.

It does **not** start Gate 16.

Numbering note: older `docs/deployment/PR6_DEPLOY_ORDER.md` still labels a different
“GATE15”. This document is the **recaptcha key-align** gate defined by Gate 14
(`docs/audit/gate14/GATE14_RECAPTCHA_400_ROOT_CAUSE.md`).

---

## Required status block

```
SOURCE_SHA=f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260
GATE14_MERGE_SHA=f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260
CHECKDOMAIN_BUILD_KEY_ALIGNED=NO
OLD_REJECTED_KEY_PRESENT=YES
LIVE_PUBLIC_KEY_CLASSIFICATION=REJECTED
GOOGLE_APIJS_RENDER_STATUS=400
CLIENT_GRECAPTCHA_LOADED=NO
CLIENT_TOKEN_MINTED=NO
SECRET_PAIRING=NOT_ASSESSABLE
LEADS_GET=200
CAREERS_GET=200
ADMIN_UNAUTH=401
DTH_LEADS_POST_EXECUTED=NO
DTH_CAREERS_POST_EXECUTED=NO
E2E_EXECUTED=NO
MAIL_SENT=NO
DB_WRITE_EXECUTED=NO
ENV_CHANGED=NO
STATIC_REBUILD_EXECUTED=NO
CHECKDOMAIN_PUBLISH_EXECUTED=NO
ROLLBACK_TARGET=LIVE_STATIC_LAST_MODIFIED_2026-09-17T18:03:28Z
GATE15_PASS=NO
ENDSTATUS=GATE15_FAIL_REMEDIATION_REQUIRED
```

Public site keys below are **client-public** (`6L…`). No secret values are printed.

---

## 0. Gate 14 merge (verified)

| Field | Value | Evidence |
|---|---|---|
| Repo | `https://github.com/Skyrunnerrr/deintarifheld` | `git remote` |
| Expected merge SHA | `f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260` | task + `git fetch origin main` |
| `origin/main` tip after fetch | `f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260` | `git rev-parse origin/main` |
| Merge parents | `8f8755a21b35822adf357d59cc3384782910c99a` + `362ed61c56303c7ee0ab76aa1f6a81b4daf69e8a` | `git log -1 --format='%H %P'` |
| PR #7 head | `362ed61c56303c7ee0ab76aa1f6a81b4daf69e8a` | `docs(audit): isolate Gate 14 reCAPTCHA HTTP 400 root cause` |
| File merged | `docs/audit/gate14/GATE14_RECAPTCHA_400_ROOT_CAUSE.md` only | `git show --name-only 362ed61` |
| Snapshot `main` before fetch | `8f8755a` (stale pre-PR#7) | local checkout at agent start |
| `SOURCE_SHA` | **same as** `GATE14_MERGE_SHA` / `origin/main` tip | this gate |

Gate 14 binding (not re-litigated): Checkdomain static inlines rejected v3 public key
`6LdCwGstAAAAAO_0-R3NTXSFWuMzbSd9MGjVZaPZ` → Google `api.js?render=` HTTP 400 → no
`grecaptcha` → no token. Vercel frontend inlines accepted
`6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS` → `api.js` HTTP 200. DTH captcha failures
are 403, not 400. Env name for the static v3 key is `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY`.

---

## 1. Prechange lock (read-only, 2026-09-18 UTC)

Documented **before** any attempted change. Re-verified GET baselines.

| Field | Value |
|---|---|
| `SOURCE_SHA` | `f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260` |
| `CHECKDOMAIN_LIVE_LAST_MODIFIED` | `Thu, 17 Sep 2026 18:03:28 GMT` (www HTML; unchanged vs Gate 14) |
| `CURRENT_PUBLIC_KEY_CLASSIFICATION` | **REJECTED** — live chunk still `6LdCwGstAAAAAO_0-R3NTXSFWuMzbSd9MGjVZaPZ` |
| `CURRENT_GOOGLE_APIJS_STATUS` | **400** `text/html` |
| `VERCEL_PUBLIC_KEY_CLASSIFICATION` | **ACCEPTED** — Vercel chunk still `6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS` |
| `VERCEL_GOOGLE_APIJS_STATUS` | **200** `text/javascript` |
| `LEADS_GET` | **200** |
| `CAREERS_GET` | **200** |
| `ADMIN_UNAUTH` | **401** |
| `FORM_POST_EXECUTED` | **NO** |
| `E2E_EXECUTED` | **NO** |
| `MAIL_SENT` | **NO** |
| `DB_WRITE_EXECUTED` | **NO** |

### Live GET probes (no POST)

| Probe | Result | Evidence |
|---|---|---|
| `GET https://www.deintarifheld.de/` | **200** nginx | `Last-Modified: Thu, 17 Sep 2026 18:03:28 GMT` |
| `GET https://deintarifheld.de/` (no follow) | **301** | `location: https://www.deintarifheld.de/` |
| `/` `/unternehmen/` `/karriere/` `/rechner/` `/datenschutz/` `/impressum/` | **200** | curl |
| Homepage same-origin assets referenced by HTML | **19/19 HTTP 200** | `NO_REQUIRED_ASSET_ERRORS=YES` |
| `GET https://deintarifheld-leads-api.vercel.app/api/leads/` | **200** | `{"ok":true,"service":"dth-leads","phase":"B","supported":["unternehmen","privat","hero-funnel","main_funnel"],"careerEndpoint":"/api/careers"}` |
| `GET https://deintarifheld-leads-api.vercel.app/api/careers/` | **200** | `{"ok":true,"service":"dth-careers","phase":"B","supported":["career"],"fileUploads":false}` |
| `GET …/api/admin/inbox/` (no secret) | **401** HTML login shell | body contains `Anfragen-Eingang` |
| Checkdomain chunk `91-031d3bf89ddd81c6.js` | **200** | `Last-Modified: Thu, 17 Sep 2026 18:02:13 GMT`; inlined rejected key; leads origin `https://deintarifheld-leads-api.vercel.app` |
| Vercel chunk `91-537133029fe61b6e.js` | **200** | inlined accepted key |

### Google `api.js?render=` (this cloud IP; Referer `https://www.deintarifheld.de/`)

| Key | URL host | HTTP | Content-Type |
|---|---|---|---|
| Rejected Checkdomain `6LdCwGst…` | `www.google.com` | **400** | `text/html` |
| Rejected Checkdomain `6LdCwGst…` | `www.recaptcha.net` | **400** | `text/html` |
| Accepted Vercel `6LdE67Es…` | `www.google.com` | **200** | `text/javascript` |
| Accepted Vercel `6LdE67Es…` | `www.recaptcha.net` | **200** | `text/javascript` |

Rejected body title: `Error 400 (Bad Request)`. Accepted body starts with Google’s `api.js` IIFE (`___grec…`).

`v2` `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is still not a live inlined render key. Live Checkdomain
takes the v3 path (`hasStandardV3SiteKey` compiled true).

---

## 2. Access assessment — Checkdomain static build host

Runbook: `docs/deployment/CHECKDOMAIN_CUTOVER_SEQUENCE.md`,
`docs/deployment/checkdomain-cutover.md`,
`scripts/deploy/checkdomain/dth-checkdomain.sh`.

Required for a real publish:

- `infra/checkdomain/config.env` (gitignored, mode `0600`) **or** equivalent env
- `CHECKDOMAIN_HOST` / `CHECKDOMAIN_USER` / `CHECKDOMAIN_REMOTE_BASE`
- `CHECKDOMAIN_SSH_IDENTITY` (BatchMode SFTP; passwords must not appear on argv)
- Local `out/` from `npm run build:static:production` at `SOURCE_SHA`

### What this agent host has

| Item | Present? |
|---|---|
| `infra/checkdomain/config.env` | **NO** (only `config.example.env`) |
| `CHECKDOMAIN_SSH_IDENTITY` | **NO** |
| `~/.ssh` / `/root/.ssh` | **NO** |
| `CHECKDOMAIN_HOST` / `USER` / `REMOTE_BASE` env | **NO** |
| `CHECKDOMAIN_API_TOKEN` | **NO** (DNS API anyway — DNS is forbidden this gate) |
| `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` in agent env | **NO** (not required to *read* the public Vercel key from live JS) |
| `RECAPTCHA_SECRET_KEY` in agent env | **NO** |
| `$HOME/.dth-checkdomain-backups` | **NO** |
| Cursor self-hosted worker with Checkdomain access | **NO** (zero connected workers) |
| Cloud-agent injected secret **names** | `CRON_SECRET`, `LEADS_ADMIN_SECRET`, `VERCEL_TOKEN` only |
| `VERCEL_TOKEN` usable to list production env names | **NO** — Vercel REST `GET /v9/projects` → HTTP 403; CLI `whoami` → `User not found` |
| GitHub Actions secrets/vars list | **NO** — HTTP 403 |

`VERCEL_TOKEN` was **not** used to mutate any Vercel env. Vercel is out of scope for
this Checkdomain-static fix.

### Stop rule applied

Task: *If you do not have Checkdomain build-host credentials/access: STOP …
do NOT invent a publish. Do not rotate secrets.*

```
MISSING_ACCESS=CHECKDOMAIN_STATIC_BUILD_HOST_AND_SFTP
INVENTED_PUBLISH=NO
KEY_ROTATION=NO
PRODUCT_CODE_CHANGED=NO
```

---

## 3. Public key change — not executed

Identified v3 public/site key (Gate 14 + live Vercel bundle + `docs/deployment/PRODUCTION_ENV_MATRIX.md`):

| Role | Env name | Classification | Full public value (client-public) |
|---|---|---|---|
| Live Checkdomain (current) | `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` | REJECTED by `api.js?render=` | `6LdCwGstAAAAAO_0-R3NTXSFWuMzbSd9MGjVZaPZ` |
| Live Vercel frontend (target) | `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` | ACCEPTED by `api.js?render=` | `6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS` |
| v2 checkbox | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | unused on live Checkdomain | not inlined as render key |

Target would have been: on **Checkdomain static build host only**, set
`NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` to the accepted Vercel v3 key (no truncation,
no whitespace, no other env scope).

```
ENV_CHANGED=NO
CHECKDOMAIN_BUILD_HOST_ENV_WRITTEN=NO
VERCEL_ENV_WRITTEN=NO
```

---

## 4. Secret pairing — truth rule

```
GOOGLE_SITEVERIFY_EXECUTED=NO
SECRET_PAIRING=NOT_ASSESSABLE
```

| Allowed status | Applied? | Why |
|---|---|---|
| `VERIFIED` | **NO** | Default Gate 15: no siteverify. Not technically proven. |
| `OPERATIONALLY_CONFIRMED` | **NO** | 2026-09-15 matrix says API `RECAPTCHA_SECRET_KEY` is PRESENT and `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY` is PRESENT on the API project, but this pass could not re-read API env (Vercel 403) and cannot prove the live secret belongs to the `6LdE67Es…` keyset vs the rejected `6LdCwGst…` key. |
| `NOT_ASSESSABLE` | **YES** | No load-bearing mapping available this pass. |

No secret values were printed. No secret was rotated.

Gate 15 can still clear the Google **400** blocker without pairing `VERIFIED`.
Gate 16 owns server verify. Pairing unknown is **not** why this gate failed;
missing Checkdomain publish access is.

---

## 5. Static build + pre-publish + publish — not executed

Approved source would have been `SOURCE_SHA=f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260`
(`origin/main`). Working tree was clean at lock. Build command from runbook:

```bash
NEXT_PUBLIC_LEADS_API_ORIGIN=https://deintarifheld-leads-api.vercel.app
NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY=<accepted-v3-public-key>
npm run build:static:production
npm run verify:static:production
```

Then `dth-checkdomain.sh backup --apply` → `upload --apply` (SSH identity required).

| Pre-publish field | This pass |
|---|---|
| `BUILD_EXIT` | N/A (`STATIC_REBUILD_EXECUTED=NO`) |
| `OLD_REJECTED_KEY_PRESENT` (artifact) | N/A (no artifact). **Live** = **YES** |
| `NEW_ACCEPTED_KEY_PRESENT` (artifact) | N/A. **Live Checkdomain** = **NO** |
| `SECRET_IN_STATIC` | N/A (no new bundle). Live scan not a secret dump |
| `LEADS_API_ORIGIN_UNCHANGED` | **YES** on live (`https://deintarifheld-leads-api.vercel.app`) |
| `RECAPTCHA_VERSION` | **V3** (live + code) |
| `PRODUCT_CODE_CHANGED` | **NO** |

```
STATIC_REBUILD_EXECUTED=NO
CHECKDOMAIN_PUBLISH_EXECUTED=NO
DNS_CHANGED=NO
```

---

## 6. Post-publish proof — live still prechange (GET + browser, no submit)

Publish did not happen. The following is the **current live** state after the stop.

| Check | Result |
|---|---|
| www 200 | **YES** |
| apex 301 → www | **YES** (unchanged) |
| Live bundle has accepted key | **NO** |
| Live bundle has rejected key | **YES** (`91-031d3bf89ddd81c6.js`) |
| `GOOGLE_APIJS_RENDER` for live inlined key | **400** |
| Browser `https://www.deintarifheld.de/karriere/` form opened | **YES** — RecaptchaBox mounted; **no submit** |
| Browser homepage hero opened to step 2 | RecaptchaBox mounted after client-only “Weiter”; **submit not clicked** |
| `CLIENT_GRECAPTCHA_LOADED` | **NO** (`typeof window.grecaptcha === 'undefined'`) |
| Captcha load-error UI | **YES** — `Captcha konnte nicht geladen werden. Bitte Seite neu laden.` |
| Script tag | `https://www.google.com/recaptcha/api.js?render=<REJECTED_KEY>` |
| Console | `reCAPTCHA loading failed: Failed to load reCAPTCHA script` |
| `CLIENT_TOKEN_MINTED` | **NO** |
| `fetch` POST `/api/leads` or `/api/careers` | **NONE** (request interceptor recorded `blockedPosts=[]`; submit never clicked) |

Browser evidence files (not committed; attached as PR artifacts):

- `/opt/cursor/artifacts/gate15/karriere-form-readonly.png`
- `/opt/cursor/artifacts/gate15/hero-step2-readonly.png`
- `/opt/cursor/artifacts/gate15/www-home.png`
- `/opt/cursor/artifacts/gate15/browser-probe.json`

---

## 7. Regression (read-only)

| Check | Result |
|---|---|
| `LEADS_GET` | **200** |
| `CAREERS_GET` | **200** |
| `ADMIN_UNAUTH` | **401** |
| Legal `/datenschutz/` `/impressum/` | **200** |
| Homepage | **200** |
| Required homepage assets | **no 4xx/5xx** (`NO_REQUIRED_ASSET_ERRORS=YES`) |
| Captcha load-error UI | **present** (expected until key align + republish) |

Hard end (this gate):

```
DTH_LEADS_POST_EXECUTED=NO
DTH_CAREERS_POST_EXECUTED=NO
E2E_EXECUTED=NO
MAIL_SENT=NO
DB_WRITE_EXECUTED=NO
CUSTOMER_MAIL_TRIGGERED=NO
DTH_PRODUCTION_POST_EXECUTED=NO
```

---

## 8. Pass / fail

PASS requires all of: `CHECKDOMAIN_BUILD_KEY_ALIGNED=YES`, `OLD_REJECTED_KEY_REMOVED=YES`,
`LIVE_GOOGLE_APIJS_RENDER=200`, `CLIENT_GRECAPTCHA_LOADED=YES`, `CLIENT_TOKEN_MINTED=YES`,
plus the GET/regression/no-submit hard flags.

This pass fails because:

1. Checkdomain live still ships the rejected `6LdCwGst…` key.
2. Google `api.js?render=<live key>` is still **400**.
3. Browser still has no `grecaptcha` and no minted token.
4. No authorized rebuild/publish was possible from this host.

```
GATE15_PASS=NO
ENDSTATUS=GATE15_FAIL_REMEDIATION_REQUIRED
```

`GATE15_BLOCKED_PAIRING_UNKNOWN` is **not** selected: pairing is `NOT_ASSESSABLE`, but
Gate 15 is allowed to clear the 400 without `SECRET_PAIRING=VERIFIED`. The blocker
is missing Checkdomain build-host / SFTP access.

---

## 9. Ops remediation (human with Checkdomain build-host access)

Do **not** change product code under `app/` or `lib/`. Do **not** rotate the API secret
unless pairing is later proven wrong. Do **not** change DNS. Do **not** POST a lead.

On the **Checkdomain static build host only**:

1. Confirm git is clean and `HEAD` is `f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260` (or a later
   approved `main` tip that still contains this report).
2. Set **only**:
   - `NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY=6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS`
     (exact; no quotes-with-newline; no truncation).
   - `NEXT_PUBLIC_LEADS_API_ORIGIN=https://deintarifheld-leads-api.vercel.app`
   - Do not set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` unless a separate v2 decision exists.
3. `npm run build:static:production` — expect exit 0.
4. Artifact scan: rejected `6LdCwGst…` hit count **0**; accepted `6LdE67Es…` present;
   leads origin unchanged; `npm run verify:static:production` pass.
5. Identify rollback: `dth-checkdomain.sh backup --apply` → record `LATEST` stamp
   (`ROLLBACK_TARGET`).
6. `dth-checkdomain.sh upload --apply` of that `out/` only. Mail gate must already pass
   (`LEADS_MAIL_MODE` not `mock`, or explicit `ALLOW_MOCK_MAIL_CUTOVER=YES` — do not
   invent that override here).
7. Re-GET `api.js?render=<new live inlined key>` → 200 JS. Browser-open a form, do
   **not** submit, prove `grecaptcha` + token minted (do not log the token).
8. Leave siteverify / server pairing to Gate 16.

---

## 10. Report metadata

| Field | Value |
|---|---|
| Build host | **UNAVAILABLE** this agent (`MISSING_ACCESS=CHECKDOMAIN_STATIC_BUILD_HOST_AND_SFTP`) |
| Build command | `npm run build:static:production` (runbook; **not executed**) |
| Publish scope | Checkdomain static tree at `CHECKDOMAIN_REMOTE_BASE` via `dth-checkdomain.sh upload --apply` (**not executed**) |
| Rollback target | Current live static: www `Last-Modified: Thu, 17 Sep 2026 18:03:28 GMT`. Procedure: `dth-checkdomain.sh rollback --apply` after a future backup. No new backup created this pass. |
| Before key / api.js | REJECTED / **400** |
| After key / api.js | unchanged REJECTED / **400** |
| grecaptcha / token | **NO** / **NO** |
| Secret pairing | `NOT_ASSESSABLE` (no values) |

---

## Final machine block (repeat)

```
GATE=15
SOURCE_SHA=f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260
GATE14_MERGE_SHA=f3d0ce2d9ca5d51e5e4305ab73a1a88441c45260
CHECKDOMAIN_BUILD_KEY_ALIGNED=NO
OLD_REJECTED_KEY_PRESENT=YES
LIVE_PUBLIC_KEY_CLASSIFICATION=REJECTED
GOOGLE_APIJS_RENDER_STATUS=400
CLIENT_GRECAPTCHA_LOADED=NO
CLIENT_TOKEN_MINTED=NO
SECRET_PAIRING=NOT_ASSESSABLE
LEADS_GET=200
CAREERS_GET=200
ADMIN_UNAUTH=401
DTH_LEADS_POST_EXECUTED=NO
DTH_CAREERS_POST_EXECUTED=NO
E2E_EXECUTED=NO
MAIL_SENT=NO
DB_WRITE_EXECUTED=NO
ENV_CHANGED=NO
STATIC_REBUILD_EXECUTED=NO
CHECKDOMAIN_PUBLISH_EXECUTED=NO
ROLLBACK_TARGET=LIVE_STATIC_LAST_MODIFIED_2026-09-17T18:03:28Z
GATE15_PASS=NO
ENDSTATUS=GATE15_FAIL_REMEDIATION_REQUIRED
```

STOP. Do not start Gate 16.
