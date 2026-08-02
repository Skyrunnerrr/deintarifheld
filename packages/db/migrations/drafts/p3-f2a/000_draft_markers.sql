-- DRAFT_ONLY
-- DO_NOT_APPLY
-- P3_F2B_OWNER_AUTHORIZATION_REQUIRED
-- TRANCHE=P3-F2A
-- MIGRATION_ID=p3_f2a_000_draft_markers
-- PURPOSE=Header / apply-ban markers for the P3-F2a draft pack (documentation SQL only)
--
-- This file must never be executed by supabase db push/reset or any auto-migrator.
-- Canonical draft root: packages/db/migrations/drafts/p3-f2a/
-- Live migration root (untouched): supabase/migrations/

SELECT 'P3_F2A_DRAFT_PACK_DO_NOT_APPLY' AS draft_status;
