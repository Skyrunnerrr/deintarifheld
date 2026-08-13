-- DTH-M11E-R1A / R1B
-- PURPOSE=Create fail-closed private DTH schemas + revoke postgres/public API-role default privileges (ACL-01)
-- AUTHORIZED_ENVIRONMENT=STAGING_ONLY (until later Production gate)
-- DOES_NOT=change existing public.leads/career_applications/audit_events grants (ACL-02 = M11G)
-- DOES_NOT=globally revoke PostgreSQL builtin PUBLIC EXECUTE on routines
-- DOES_NOT=mutate provider schemas (auth/storage/realtime/graphql*/vault/extensions/supabase_migrations)
-- DOES_NOT=create tables/roles/policies

BEGIN;

-- ─── Private schemas (fail loudly if already present) ───────────────────────
CREATE SCHEMA ops AUTHORIZATION postgres;
CREATE SCHEMA security AUTHORIZATION postgres;
CREATE SCHEMA workflow AUTHORIZATION postgres;
CREATE SCHEMA audit AUTHORIZATION postgres;

-- Explicit fail-closed schema privileges for API / PUBLIC roles
REVOKE ALL ON SCHEMA ops FROM PUBLIC;
REVOKE ALL ON SCHEMA security FROM PUBLIC;
REVOKE ALL ON SCHEMA workflow FROM PUBLIC;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;

REVOKE USAGE, CREATE ON SCHEMA ops FROM anon, authenticated, service_role;
REVOKE USAGE, CREATE ON SCHEMA security FROM anon, authenticated, service_role;
REVOKE USAGE, CREATE ON SCHEMA workflow FROM anon, authenticated, service_role;
REVOKE USAGE, CREATE ON SCHEMA audit FROM anon, authenticated, service_role;

-- ─── ACL-01: remove schema-specific postgres/public future auto-grants ───────
-- Observed R0 causal source: ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
-- granted tables/sequences/functions to anon/authenticated/service_role.
-- These REVOKEs affect FUTURE objects only; existing object grants unchanged.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON ROUTINES FROM anon, authenticated, service_role;

COMMIT;
