# Delete / retention modes (technical)

```
DELETE_STATE_MACHINE=PASS
DELETION_MODE_EXPLICIT=PASS
DSGVO_DELETE_SEMANTICS=PASS
LEGAL_HOLD_SEPARATION=PASS
PII_STATE_NAMING=PASS
REDACTED_PLACEHOLDER_INPUT_BLOCKED=PASS
PHYSICAL_EMAIL_DELETE_REDACTED_BLOCKED=PASS
MASS_DELETE_FOOTGUN_CLOSED=PASS
POST_REDACTION_EMAIL_LOOKUP=NOT_AVAILABLE
REDACTED_PHYSICAL_ERASURE_REQUIRES_UNIQUE_REF=YES
LEGAL_REVIEW_REQUIRED=YES
```

This file does **not** invent statutory retention periods. App cutoffs (`LEADS_RETENTION_DAYS` etc.) are operational defaults pending Legal.

Column `anonymized_at` is a **technical legacy name** (set in `004`). Semantic meaning: redacted / PII-minimised at. It is **not** legal anonymisation.

Explicit states (`classifyPiiState`): `ACTIVE`, `SOFT_DELETED`, `LEGAL_HOLD`, `REDACTED`, `PHYSICALLY_DELETED`. `status=deleted` alone is never `LEGAL_HOLD`.

## Modes (explicit)

Legal/Ops chooses the mode for a data-subject request. Code does not invent that decision.

| Mode | Meaning | What happens |
|---|---|---|
| `soft` | Technical soft-deactivation | `status=deleted`, payload intact. Not a legal hold. |
| `redact` | PII minimisation | Email replaced, identity/contact/message PII stripped, `anonymized_at` set. `firma` may remain on business rows. **Not legal anonymisation.** |
| `physical` | Physical DB deletion | Row removed |

`anonymise` is a **deprecated alias for `redact` only**. It must not be treated as legal anonymisation.

The admin endpoint requires `mode`. Missing mode → `400 deletion-mode-required`. There is no default.

## Eligibility

Eligible unless **separately** `legal_hold=true`:

- active → redact
- active → physical
- active → soft
- soft-deleted (`status=deleted`) + `anonymized_at IS NULL` → redact
- soft-deleted + `anonymized_at IS NULL` → physical
- historic deleted + null `anonymized_at` → inventory via dry-run; later cleanup is separately authorized

Already-redacted (`anonymized_at` set) → no second PII rewrite.

Email-based physical delete applies only to rows found by the **original unique email** that are still `ACTIVE` or `SOFT_DELETED`. `REDACTED` rows are **not** physical-email eligible.

`POST /api/admin/leads/delete` and `scripts/leads-delete-by-email.mjs` hard-reject `REDACTED_EMAIL` (`redacted@invalid.invalid`) for every mode (`soft` | `redact` | `physical`) with `400 redacted-placeholder-not-allowed`. That address is a shared placeholder. There is no bulk physical-delete for it.

## Post-redaction lookup

```
POST_REDACTION_EMAIL_LOOKUP=NOT_AVAILABLE
REDACTED_PHYSICAL_ERASURE_REQUIRES_UNIQUE_REF=YES
```

Redaction replaces the original email with the shared placeholder. Residual fields (for example `firma` on a business row) may remain. A later data-subject request **cannot** be resolved by looking up the original email. Do not invent an automatic reverse lookup.

Physical erasure of an already-redacted row requires a **separately authorized unique-identifier process** (`id` / `lead_ref` / `application_ref`, or a future subject key). That destructive endpoint is **not** part of this PR.

Optional later design note only: a `subject_key_hmac` (HMAC of a Legal/Ops-chosen subject key, distinct salt) could support unique-ref lookup without storing the original email. It is **not implemented**. No personal lookup architecture is added here.

Retention skips `legal_hold=true`. Soft-delete is not a hold. Application code never auto-sets `legal_hold`.

Historic inventory: `npm run leads:historic:dry-run`. `HISTORIC_CLEANUP_EXECUTION_READY=NO`.

## Delete audits

Future delete audits store `email_hmac` (HMAC-SHA256) with **`AUDIT_EMAIL_HASH_SALT`**, which must be distinct from `LEADS_RATE_LIMIT_SALT` and session secrets.

If the salt is missing, audits still **omit plaintext email** (`email_hmac=null`, `salt_configured=false`). They do not fall back to storing the address.

## Admin API

`POST /api/admin/leads/delete` requires body `mode`: `soft` | `redact` | `physical` (or deprecated `anonymise` → `redact`). The route does not claim a legal DSGVO erase. Shared `REDACTED_EMAIL` is rejected (`redacted-placeholder-not-allowed`).
