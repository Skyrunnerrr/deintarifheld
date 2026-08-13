# Pre-M11 Security Legacy Local Migrations (003–013)

```text
DO_NOT_APPLY
REFERENCE_ONLY
NOT_GOVERNED_REMOTE_HISTORY
NEVER_APPLIED_TO_GOVERNED_PRODUCTION
NEVER_APPLIED_TO_GOVERNED_STAGING
HISTORICAL_LOCAL_FOUNDATION
```

These files were previously located under `supabase/migrations/` as local-only
foundation candidates (`LOCAL_APPLY_ONLY=YES`). They were **never** applied to
governed Production (`deintarifheld-phase-a`) or governed Staging
(`deintarifheld-staging`). Both remotes remain at migrations `001` and `002` only.

## Why archived

Leaving them in the active Supabase migration root caused normal `db push`
dry-runs to treat 003–013 as pending. They are quarantined here so the active
root truthfully matches governed remote history:

```text
ACTIVE = 001, 002
```

## Rules

- Do **not** copy these files blindly back into `supabase/migrations/`.
- Do **not** mark them applied via `migration repair` or manual
  `schema_migrations` inserts.
- Do **not** execute them as a batch against governed environments.
- Future implementation must produce **new timestamp-based governed migrations**
  after redesign under the frozen M11 architecture.
- SQL contents are preserved byte-identical; see `MANIFEST.md` for SHA256.

## Canonical active root

`supabase/migrations/` remains the only Supabase CLI apply root.
