# Delete / retention modes (technical)

```
DELETE_STATE_MACHINE=PASS
LEGAL_HOLD_SEPARATION=PASS
HISTORIC_SOFT_DELETE_CLEANUP=PASS
PII_STATE_NAMING=PASS
LEGAL_REVIEW_REQUIRED=YES
```

This file does **not** invent statutory retention periods. App cutoffs (`LEADS_RETENTION_DAYS` etc.) are operational defaults pending Legal.

Column `anonymized_at` is a **technical legacy name** (set in `004`). Semantic meaning: redacted / PII-minimised at. It is **not** legal anonymisation. A second column was not added, to avoid dual-write drift. Keeping `firma` on a business row is redacted / minimised / pseudonymised ops state — not an anonymous state.

Explicit states (`classifyPiiState`): `ACTIVE`, `SOFT_DELETED`, `LEGAL_HOLD`, `REDACTED`, `PHYSICALLY_DELETED`. `status=deleted` alone is never `LEGAL_HOLD`.

## Modes

| Mode | What happens | When |
|---|---|---|
| `soft` | `status=deleted`, `deleted_at` set, **payload intact**. Does **not** set `legal_hold`. | Explicit soft only |
| `anonymise` | `status=deleted`, email replaced with `redacted@invalid.invalid`, identity/contact/message PII stripped from payload, `anonymized_at` set. `firma` kept only on business (`unternehmen`) rows | Default admin erase; retention job |
| `physical` | Row deleted from `leads` / `career_applications` | Explicit `mode=physical` only |

## Eligibility

Eligible unless **separately** `legal_hold=true`:

- active → redact
- active → physical
- active → soft
- soft-deleted (`status=deleted`) + `anonymized_at IS NULL` → redact
- soft-deleted + `anonymized_at IS NULL` → physical
- historic deleted + null `anonymized_at` → cleanup via the same erase path

Already-redacted (`anonymized_at` set) → no second PII rewrite.

Retention skips `legal_hold=true`. Soft-delete is not a hold. Application code never auto-sets `legal_hold`.

Historic inventory: `npm run leads:historic:dry-run` / `docs/compliance/HISTORIC_SOFT_DELETE_CLEANUP.md`. No production mutation from this PR.

## Delete audits

Future delete audits store `email_hmac` (HMAC-SHA256) with **`AUDIT_EMAIL_HASH_SALT`**, which must be distinct from `LEADS_RATE_LIMIT_SALT` and session secrets.

If the salt is missing, audits still **omit plaintext email** (`email_hmac=null`, `salt_configured=false`). They do not fall back to storing the address.

## Admin API

`POST /api/admin/leads/delete` defaults to `mode=anonymise`. Optional body `mode`: `soft` | `anonymise` | `physical`.
