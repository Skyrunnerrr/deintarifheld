-- DRAFT_ONLY
-- DO_NOT_APPLY
-- P3_F2B_OWNER_AUTHORIZATION_REQUIRED
-- TRANCHE=P3-F2A
-- MIGRATION_ID=p3_f2a_110_indexes_and_validation
-- PURPOSE=Additive cross-cutting indexes / validation notes already largely inline;
--         this file records pack completion markers and correlation helper indexes.
-- ADDITIVE_ONLY=YES
-- EXISTING_OBJECTS_TOUCHED=none
-- DATA_BACKFILL_REQUIRED=NO

CREATE INDEX IF NOT EXISTS cases_correlation_idx
  ON public.cases (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_correlation_idx
  ON public.tasks (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS case_notes_correlation_idx
  ON public.case_notes (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_events_correlation_idx
  ON public.communication_events (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Explicit non-claims (documentation via comments only; no DDL on existing spine)
-- PUBLIC_SPINE_UNCHANGED=YES
-- LEADS_CAREER_TABLES_UNMODIFIED=YES
-- FORBIDDEN_DOMAIN_TABLES=0
-- EXTERNAL_PROVIDER_SCHEMA=0

SELECT 'P3_F2A_INDEXES_VALIDATION_DRAFT_DO_NOT_APPLY' AS draft_status;
