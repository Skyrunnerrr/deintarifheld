-- DTH-M11G workload-specific NOLOGIN privilege groups
-- PURPOSE=Separate runtime grants per workload (no collapse on dth_grp_runtime)
-- DOES_NOT=grant object privileges (next migration)
-- DOES_NOT=start M11H+

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dth_grp_public_intake') THEN
    CREATE ROLE dth_grp_public_intake NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dth_grp_worker') THEN
    CREATE ROLE dth_grp_worker NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dth_grp_ops_api') THEN
    CREATE ROLE dth_grp_ops_api NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
  END IF;
END
$$;

-- Workload LOGIN → dedicated group (+ empty dth_grp_runtime marker from M11F).
GRANT dth_grp_public_intake TO dth_public_intake;
GRANT dth_grp_worker TO dth_worker;
GRANT dth_grp_ops_api TO dth_ops_api;

ALTER ROLE dth_grp_public_intake SET search_path TO pg_catalog;
ALTER ROLE dth_grp_worker SET search_path TO pg_catalog;
ALTER ROLE dth_grp_ops_api SET search_path TO pg_catalog;

COMMIT;
