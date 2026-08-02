# @deintarifheld/db

DTH-owned database / migrations package boundary.

## P3-F2a status

- **Draft migrations only** under `migrations/drafts/p3-f2a/`
- Markers: `DRAFT_ONLY` · `DO_NOT_APPLY` · `P3_F2B_OWNER_AUTHORIZATION_REQUIRED`
- **Not** consumed by Supabase CLI (`supabase/migrations/` remains the live/apply root and is untouched)
- `MIGRATION_APPLICATION_AUTHORIZED=NO` in this tranche
- No local/remote database mutation in P3-F2a

## Security claims

- `STRONG_AUTHZ_COMPLETE=NO`
- `PRODUCTION_RLS_READY=NO`
- Browser direct access not granted; drafts enable RLS and revoke public/anon/authenticated grants without permissive policies

## Tests

```bash
npm run test -w @deintarifheld/db
```

Static TG-02A checks only — no database connection.
