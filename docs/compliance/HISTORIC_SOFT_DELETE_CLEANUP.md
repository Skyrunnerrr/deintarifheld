# Historic soft-delete cleanup — dry-run path

```
HISTORIC_SOFT_DELETE_CLEANUP=PASS
HISTORIC_CLEANUP_APPLIED=NO
PRODUCTION_DATA_MUTATED=NO
LEGAL_REVIEW_REQUIRED=YES
```

Safe path exists: `scripts/historic-soft-delete-dry-run.mjs` (default dry-run). It does **not** authorize production mutation. Apply requires `APPLY_HISTORIC_CLEANUP=YES` **and** `EXPLICITLY_AUTHORIZED_CLEANUP=YES` on a **non-production** runtime; production apply is blocked.

## Why a plan is required

Before PR #6 closure, `loadLeadsForDeletion` / `loadCareersForDeletion` / retention used `neq(status, deleted)`. Soft-deleted rows that still hold PII (`status=deleted`, `anonymized_at IS NULL`) were therefore skipped forever.

Soft-delete is **not** a legal hold. Only an explicit `legal_hold=true` row is skipped.

## Dry-run (ops, after 005 is applied)

```
node scripts/historic-soft-delete-dry-run.mjs
```

Eligible: `status=deleted` AND `anonymized_at IS NULL` AND `legal_hold` is not true (`SOFT_DELETED`). Output is counts plus safe refs (`lead_ref` / `application_ref` / `id`). No email, no payload.

`legal_hold=true` rows are excluded in application filter even if a backend preview included them.

## Proposed later cleanup (not run here)

1. Legal confirms there is no separate hold on those rows.
2. Ops runs the existing admin erase path (`mode=anonymise` / redaction) **or** an approved retention job — not a new unpublished script against production from this PR.
3. Already-redacted rows (`anonymized_at` set) must not be rewritten with new PII.
4. Physical delete only with an explicit `mode=physical` decision.

Do **not** invent legal_hold=true for historic rows.

## Gate

`HISTORIC_SOFT_DELETE_CLEANUP=PASS` means the dry-run path and eligibility rules exist and are tested. It does **not** mean production leftovers were cleaned. `HISTORIC_CLEANUP_APPLIED=NO`.
