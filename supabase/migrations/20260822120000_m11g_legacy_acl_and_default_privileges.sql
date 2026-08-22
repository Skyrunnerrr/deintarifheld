-- DTH-M11G ACL-02 cleanup + default-privilege hardening (future objects)
-- PURPOSE=Revoke unjustified broad public spine grants; fail-closed defaults
-- DOES_NOT=revoke service_role (M11Q/S)
-- DOES_NOT=change Data API exposed schema list

BEGIN;

-- ─── ACL-02: public spine — revoke unjustified broad grants ─────────────────
REVOKE ALL ON TABLE public.leads FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.career_applications FROM PUBLIC;
REVOKE ALL ON TABLE public.cases FROM PUBLIC;
REVOKE ALL ON TABLE public.transactional_outbox FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.leads FROM anon;
    REVOKE ALL ON TABLE public.audit_events FROM anon;
    REVOKE ALL ON TABLE public.career_applications FROM anon;
    REVOKE ALL ON TABLE public.cases FROM anon;
    REVOKE ALL ON TABLE public.transactional_outbox FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.leads FROM authenticated;
    REVOKE ALL ON TABLE public.audit_events FROM authenticated;
    REVOKE ALL ON TABLE public.career_applications FROM authenticated;
    REVOKE ALL ON TABLE public.cases FROM authenticated;
    REVOKE ALL ON TABLE public.transactional_outbox FROM authenticated;
  END IF;
END
$$;

-- Private schemas: ensure API roles cannot gain USAGE via legacy grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA ops, security, workflow FROM anon;
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'audit') THEN
      REVOKE ALL ON SCHEMA audit FROM anon;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA ops, security, workflow FROM authenticated;
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'audit') THEN
      REVOKE ALL ON SCHEMA audit FROM authenticated;
    END IF;
  END IF;
END
$$;

-- ─── Default privileges: future objects must not auto-grant broadly ──────────
DO $$
DECLARE
  s text;
  roles text := 'PUBLIC, dth_grp_runtime, dth_grp_public_intake, dth_grp_worker, dth_grp_ops_api';
  extra text;
BEGIN
  SELECT string_agg(quote_ident(rolname), ', ')
  INTO extra
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'service_role');
  IF extra IS NOT NULL THEN
    roles := roles || ', ' || extra;
  END IF;

  FOREACH s IN ARRAY ARRAY['ops', 'security', 'workflow', 'audit', 'public']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I
           REVOKE ALL ON TABLES FROM %s',
        s, roles
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I
           REVOKE ALL ON SEQUENCES FROM %s',
        s, roles
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I
           REVOKE ALL ON ROUTINES FROM %s',
        s, roles
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;
