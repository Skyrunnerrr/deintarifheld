# Historic soft-delete cleanup — plan only

```
HISTORIC_SOFT_DELETE_CLEANUP=PLAN_ONLY
PRODUCTION_DATA_MUTATED=NO
LEGAL_REVIEW_REQUIRED=YES
```

This is a **plan**. It does **not** authorize production reads that mutate data, bulk erase jobs, or live SQL from this PR.

## Why a plan is required

Before PR #6 closure, `loadLeadsForDeletion` / `loadCareersForDeletion` / retention used `neq(status, deleted)`. Soft-deleted rows that still hold PII (`status=deleted`, `anonymized_at IS NULL`) were therefore skipped forever.

Soft-delete is **not** a legal hold. Only an explicit `legal_hold=true` row is skipped.

## Inventory (ops, after 005 is applied, read-only)

Count, do not update:

- `leads` where `status = 'deleted'` and `anonymized_at is null` and `legal_hold is not true`
- `career_applications` with the same predicates

Record counts and date range. Do not export raw PII into tickets.

## Proposed later cleanup (not run here)

1. Legal confirms there is no separate hold on those rows.
2. Ops runs the existing admin erase path (`mode=anonymise` / redaction) **or** an approved retention job — not a new unpublished script against production from this PR.
3. Already-redacted rows (`anonymized_at` set) must not be rewritten with new PII.
4. Physical delete only with an explicit `mode=physical` decision.

Do **not** invent legal_hold=true for historic rows.

## Gate

`HISTORIC_SOFT_DELETE_CLEANUP=PASS` only after Legal/Ops execute the inventory + approved cleanup. Until then: `PLAN_ONLY`.
