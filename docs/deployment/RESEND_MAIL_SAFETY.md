# Resend / mail safety (no mail sent)

```
RESEND_CONFIG_READY=UNKNOWN
INTERNAL_MAIL_FLOW_READY=YES
CUSTOMER_MAIL_ENABLED=NO
CUSTOMER_MAIL_GUARD=PASS
```

No Resend API call and no customer mail were sent in this pass.

## Code contract (`lib/leads/mail.js`)

| Mode | Internal Resend | Customer confirmation |
|---|---|---|
| `mock` (default if unset) | NO | n/a |
| `fail` | NO | n/a |
| `internal_live` | YES (one ops mail) | `skipped` always |
| `live` | YES | only if `ALLOW_CUSTOMER_MAIL=YES` (`customerMailDualGuardOpen`) |
| any other value | fail-closed, no network | n/a |

Missing `RESEND_API_KEY` / `LEADS_FROM_EMAIL` / `LEADS_TO_EMAIL` in `internal_live` or `live` → `mail-not-configured`, `mail_status=failed`. Provider errors → `mail_status=failed` (not invented success). Unified inquiry then gets one cron retry (`/api/cron/inquiry-mail`): success `internal_sent`, second failure `failed_final`. Inquiry types never send customer mail, including `live` + `ALLOW_CUSTOMER_MAIL=YES`.

## Customer mail shell (built, gate off)

`lib/leads/customer-mail.js` renders one shared HTML shell for `private`, `business`, `partner`, and `general`. `sendLeadEmails` does not call it. `shouldSendCustomerMail` returns false for every unified `inquiry_type`, even when `LEADS_MAIL_MODE=live` and `ALLOW_CUSTOMER_MAIL=YES`.

Header cleanup (`stripMailControls`) lives in `lib/leads/mail-safety.js`. `mail.js` and `customer-mail.js` both import that module and do not import each other. Business status bar and button use dark text `#090B15` on brand orange `#F98540`.

Preview, no send:

```
npm run mail:customer:preview
```

Open `tmp/customer-mail-preview/index.html` and the four HTML files. Resize the browser for a narrow viewport. Do not enable `ALLOW_CUSTOMER_MAIL` for this review. The gate stays off until Averi explicitly enables it.

Unit tests cover dual-guard block, mock, fail, and internal-live. `CUSTOMER_CONFIRMATION_SEND_COUNT=0` in CI.

## Production unknowns

- Whether Production `LEADS_MAIL_MODE` is actually `internal_live`
- Whether the Resend domain / `LEADS_FROM_EMAIL` is verified
- Whether `LEADS_TO_EMAIL` reaches the intended ops mailbox
- Resend account region / DPA

`RESEND_CONFIG_READY=UNKNOWN` until a human confirms those **without printing the API key**.

Intended cutover mail posture: `LEADS_MAIL_MODE=internal_live`, `ALLOW_CUSTOMER_MAIL=NO`. Do not set `live`+`YES` from this PR.
