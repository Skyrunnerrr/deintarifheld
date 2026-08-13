-- DTH-M11E-R3B / R3C
-- PURPOSE=Remove PostgreSQL builtin PUBLIC EXECUTE default for FUTURE routines created as postgres
-- DECISION=M11E-R3A OPTION_A (engine-proven transactionally; schema-scoped PUBLIC revoke is ineffective)
-- AUTHORIZED_ENVIRONMENT=STAGING_ONLY until later Production gate
-- DOES_NOT=change existing routine ACLs (ALTER DEFAULT PRIVILEGES is future-only)
-- DOES_NOT=alter other creator-role defaults (supabase_admin / *_admin / dth_*)
-- DOES_NOT=mutate provider schemas, tables, RLS, or API-role grants
-- ROLLBACK_SEMANTIC (incident only; not auto-applied):
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON ROUTINES TO PUBLIC;

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON ROUTINES FROM PUBLIC;

COMMIT;
