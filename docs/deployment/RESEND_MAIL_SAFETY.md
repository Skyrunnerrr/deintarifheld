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

Missing `RESEND_API_KEY` / `LEADS_FROM_EMAIL` / `LEADS_TO_EMAIL` in `internal_live` or `live` → `mail-not-configured`, `mail_status=failed`. Provider errors → `mail_status=failed` (not invented success).

Unit tests cover dual-guard block, mock, fail, and internal-live. `CUSTOMER_CONFIRMATION_SEND_COUNT=0` in CI.

## Production unknowns

- Whether Production `LEADS_MAIL_MODE` is actually `internal_live`
- Whether the Resend domain / `LEADS_FROM_EMAIL` is verified
- Whether `LEADS_TO_EMAIL` reaches the intended ops mailbox
- Resend account region / DPA

`RESEND_CONFIG_READY=UNKNOWN` until a human confirms those **without printing the API key**.

Intended cutover mail posture: `LEADS_MAIL_MODE=internal_live`, `ALLOW_CUSTOMER_MAIL=NO`. Do not set `live`+`YES` from this PR.
