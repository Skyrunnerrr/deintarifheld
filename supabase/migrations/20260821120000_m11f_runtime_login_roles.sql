-- DTH-M11F Runtime LOGIN roles (local additive foundation)
-- PURPOSE=Create least-privilege LOGIN identities for future hosted workloads.
-- DOES_NOT=grant private schema/table privileges (M11G)
-- DOES_NOT=map auth.users / operators (M11H)
-- DOES_NOT=retire service_role (M11S)
-- DOES_NOT=change Data API exposure
-- DOES_NOT=store credential secrets in SQL
-- AUTHORIZED_ENVIRONMENT=LOCAL_DISPOSABLE_FIRST (hosted proof NOT claimed)

BEGIN;

-- NOLOGIN privilege carrier for future M11G grants (empty in M11F).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dth_grp_runtime') THEN
    CREATE ROLE dth_grp_runtime NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      INHERIT;
  END IF;
END
$$;

-- Canonical LOGIN roles from docs/autonomous-os/07_IMPLEMENTATION_PLAN.md §11.
-- A) ops/app server  B) automation worker  C) public intake (M11Q later)
-- Provider-dispatch remains on worker for V1 (no fourth LOGIN until evidence requires).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dth_ops_api') THEN
    CREATE ROLE dth_ops_api LOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      INHERIT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dth_worker') THEN
    CREATE ROLE dth_worker LOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      INHERIT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dth_public_intake') THEN
    CREATE ROLE dth_public_intake LOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      INHERIT;
  END IF;
END
$$;

-- Membership: LOGIN → empty group only (no admin / service_role / postgres).
GRANT dth_grp_runtime TO dth_ops_api;
GRANT dth_grp_runtime TO dth_worker;
GRANT dth_grp_runtime TO dth_public_intake;

-- Safe search_path: no writable-schema-before-trusted shadowing.
ALTER ROLE dth_ops_api SET search_path TO pg_catalog;
ALTER ROLE dth_worker SET search_path TO pg_catalog;
ALTER ROLE dth_public_intake SET search_path TO pg_catalog;
ALTER ROLE dth_grp_runtime SET search_path TO pg_catalog;

-- Explicit: no private schema USAGE in M11F.
REVOKE ALL ON SCHEMA ops FROM dth_ops_api, dth_worker, dth_public_intake, dth_grp_runtime;
REVOKE ALL ON SCHEMA security FROM dth_ops_api, dth_worker, dth_public_intake, dth_grp_runtime;
REVOKE ALL ON SCHEMA workflow FROM dth_ops_api, dth_worker, dth_public_intake, dth_grp_runtime;
-- audit may be absent on some local boots; guarded:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'audit') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA audit FROM dth_ops_api, dth_worker, dth_public_intake, dth_grp_runtime';
  END IF;
END
$$;

COMMIT;
