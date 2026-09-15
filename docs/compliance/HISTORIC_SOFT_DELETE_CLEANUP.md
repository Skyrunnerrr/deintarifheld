# Historic soft-delete cleanup — inventory only

```
HISTORIC_CLEANUP_DISCOVERY=PASS
HISTORIC_CLEANUP_EXECUTION=NO
HISTORIC_CLEANUP_EXECUTION_READY=NO
HISTORIC_CLEANUP_APPLIED=NO
PRODUCTION_DATA_MUTATED=NO
LEGAL_REVIEW_REQUIRED=YES
```

`scripts/historic-soft-delete-dry-run.mjs` is **DRY RUN / INVENTORY ONLY**. It has **no apply path**. Later cleanup is a separately authorized ops process.

## Why inventory is required

Before PR #6 closure, `loadLeadsForDeletion` / `loadCareersForDeletion` / retention used `neq(status, deleted)`. Soft-deleted rows that still hold PII (`status=deleted`, `anonymized_at IS NULL`) were therefore skipped forever.

Soft-delete is **not** a legal hold. Only an explicit `legal_hold=true` row is skipped.

## Dry-run (ops, after 005 is applied)

```
node scripts/historic-soft-delete-dry-run.mjs
```

Eligible: `status=deleted` AND `anonymized_at IS NULL` AND `legal_hold` is not true (`SOFT_DELETED`). Output is counts plus safe refs (`lead_ref` / `application_ref` / `id`). No email, no payload.

## Later cleanup (not in this PR)

Legal/Ops chooses an explicit admin mode (`soft` | `redact` | `physical`) for leftover rows. This repository does not implement or authorize that apply step.

Do **not** invent legal_hold=true for historic rows.
