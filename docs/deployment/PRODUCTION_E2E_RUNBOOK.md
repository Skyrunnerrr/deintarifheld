# Production E2E runbook (do not execute from PR #6)

```
PRODUCTION_E2E_RUNBOOK_READY=YES
PRODUCTION_E2E_EXECUTED=NO
PRODUCTION_E2E_READY=NO
STATUS=NOT_AUTHORIZED_FROM_PR6
LIVE_LEAD_SUBMITTED=NO
```

E2E = full path from public form to internal processing. This document does **not** authorize a live submit.

## Test dataset (when a human later authorizes)

Use a uniquely marked TEST identity, for example:

- email: an **internal** mailbox you control, local-part containing `dth-e2e-<date>-<sha7>`
- name / message: `DTH_E2E_TEST <SHA> do-not-process`
- never a real customer address
- never `*@example.invalid` if Resend must deliver internally

Career/partner flow: **only if explicitly approved** in the same ops order. Default: private, then business.

## Preconditions (values never printed)

See `docs/deployment/PRODUCTION_ENV_MATRIX.md` and `docs/deployment/PR6_DEPLOY_ORDER.md`.
Migrations 003–005 applied and verified. Checkdomain static built from the **merged** SHA. `ALLOW_CUSTOMER_MAIL=NO`. No smoke-bypass.

## Controlled sequence (private first)

1. Open Checkdomain production site `https://www.deintarifheld.de`.
2. Complete the **private** test inquiry with the TEST dataset.
3. Complete captcha (v2 checkbox and/or v3 execute as shown). Do not use curl.
4. Confirm API JSON: `ok: true`; `customerConfirmation` is `skipped` / not sent.
5. Confirm Supabase row (ops): TEST email, `page_source` private, payload present.
6. Confirm `lead_ref` returned and stored.
7. Confirm **one** internal Resend mail at the ops address (`LEADS_TO_EMAIL`).
8. Confirm `mail_status` is truthful (`internal_sent` or `failed` — never invented success).
9. Confirm the same row in ops inbox after admin auth (`/api/admin/inbox/`).
10. Confirm an audit event for accept / internal mail (no plaintext customer email in delete-audit style fields).
11. Confirm **no** mail at the form (customer) address.
12. Clean up **only** via the approved test procedure: admin erase-by-email with explicit mode chosen by Legal/Ops (`soft` \| `redact` \| `physical`) on the **original unique TEST email**. Never use `REDACTED_EMAIL`. Record the mode.

Then repeat 1–12 for the **business** form if the same order includes it.

## PASS definition

| Gate | Required |
|---|---|
| FRONTEND_SUBMIT | PASS |
| API_ACCEPT | PASS |
| SUPABASE_INSERT | PASS |
| INTERNAL_MAIL | PASS |
| MAIL_STATUS_TRUE | PASS |
| OPS_INBOX | PASS |
| AUDIT_EVENT | PASS |
| CUSTOMER_MAIL_SENT | NO |
| NO_DUPLICATE | PASS (single submit → one row / one ops mail) |
| NO_SECURITY_REGRESSION | PASS (unauth inbox hidden; captcha still required; no secret leakage) |

## FAIL examples

- 403 `request-blocked` from the real site (origin allowlist)
- 403 `captcha-*` after a completed widget
- 429 from missing rate-limit backend
- 500 `storage-not-configured`
- Customer received confirmation
- Inbox HTML without login
- GET health leaks mail mode

## Rollback (if the authorized test misbehaves)

1. Set `LEADS_MAIL_MODE=mock` on the Production API (stops provider mail).
2. Do **not** remove `RECAPTCHA_PROJECT_ID` or `RECAPTCHA_API_KEY` (production fail-closes intake). `RECAPTCHA_SECRET_KEY` is not load-bearing.
3. Checkdomain: `dth-checkdomain.sh rollback --apply` to last backup.
4. Do not drop Supabase tables. Do not run `npm audit fix`.

## Secrets that must never be printed

`RECAPTCHA_API_KEY`, `RECAPTCHA_SECRET_KEY` (legacy/unused), `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `LEADS_ADMIN_SECRET`, `CRON_SECRET`, `LEADS_INTAKE_SMOKE_SECRET`, `LEADS_RATE_LIMIT_SALT`, `AUDIT_EMAIL_HASH_SALT`, inbox cookie `dth_admin`.
