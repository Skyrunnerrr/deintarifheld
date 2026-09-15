# Delete / retention modes (technical)

```
DELETE_ANONYMISATION_TECH=PASS
AUDIT_PLAINTEXT_EMAIL_REMOVED=PASS
LEGAL_REVIEW_REQUIRED=YES
```

This file does **not** invent statutory retention periods. App cutoffs (`LEADS_RETENTION_DAYS` etc.) are operational defaults pending Legal.

## Modes

| Mode | What happens | When |
|---|---|---|
| `soft` | `status=deleted`, `deleted_at` set, **payload intact** | Legal hold / explicit soft only |
| `anonymise` | `status=deleted`, email replaced, `full_name`/phone/messages/PII stripped from payload, `anonymized_at` set. `firma` kept only on business (`unternehmen`) rows | Default admin erase; retention job |
| `physical` | Row deleted from `leads` / `career_applications` | Explicit `mode=physical` only |

Soft-delete **alone** is not the long-term erase path. Retention no longer leaves expired rows fully intact with only `status=deleted`.

## Delete audits

Future delete audits store `email_hmac` (HMAC-SHA256) with **`AUDIT_EMAIL_HASH_SALT`**, which must be distinct from `LEADS_RATE_LIMIT_SALT` and session secrets.

If the salt is missing, audits still **omit plaintext email** (`email_hmac=null`, `salt_configured=false`). They do not fall back to storing the address.

## Admin API

`POST /api/admin/leads/delete` defaults to `mode=anonymise`. Optional body `mode`: `soft` | `anonymise` | `physical`.
