# P3-F2b — Local First-Slice Migration Apply

TRANCHE=P3-F2B  
LOCAL_DATABASE_ENVIRONMENT=SUPABASE_CLI_LOCAL_STACK  
REMOTE_SUPABASE=FORBIDDEN  
KILL_STATE_INCLUDED=NO  

## Inputs

- Draft root (frozen, unchanged): `packages/db/migrations/drafts/p3-f2a/` (13 artifacts)
- Executable forward migrations promoted: 11 → `supabase/migrations/003`…`013`
- Non-executable artifacts kept out of apply path: `000_draft_markers.sql`, `900_safe_down_draft.sql`

## Validation

- Two independent fresh replays via `supabase db reset --local`
- Deterministic schema fingerprint equivalence
- TG-03 synthetic model + lead/career insert compatibility
- Safe-down reference validated only on disposable local state

## Non-claims

- No remote apply / link / push
- No production persistence
- No capability activation
- P3-F6 kill-switch remains in-memory (not persisted here)
