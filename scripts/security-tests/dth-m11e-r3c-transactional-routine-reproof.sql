-- DTH-M11E-R3C disposable transactional routine re-proof
-- MUST ROLLBACK. Never place in supabase/migrations/.
-- OWNER_APPROVAL: APPROVE DTH-M11E-R3C STAGING TRANSACTIONAL ROUTINE REPROOF ONLY
-- Persistent global revoke already applied via migration 20260813171649.

BEGIN;

CREATE FUNCTION public.__dth_m11e_r3c_fn() RETURNS integer
  LANGUAGE sql AS $$ SELECT 1 $$;

CREATE FUNCTION ops.__dth_m11e_r3c_fn() RETURNS integer
  LANGUAGE sql AS $$ SELECT 1 $$;

SELECT jsonb_build_object(
  'current_user', current_user::text,
  'session_user', session_user::text,
  'postgres_global_fn_defacl', coalesce((
    SELECT d.defaclacl::text
    FROM pg_default_acl d
    JOIN pg_roles r ON r.oid=d.defaclrole
    WHERE r.rolname='postgres' AND d.defaclnamespace=0 AND d.defaclobjtype='f'
  ), 'NONE_EXPLICIT'),
  'public_fn', jsonb_build_object(
    'proacl', (SELECT p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public' AND p.proname='__dth_m11e_r3c_fn'),
    'public_execute', has_function_privilege('public','public.__dth_m11e_r3c_fn()','EXECUTE'),
    'anon_effective', has_function_privilege('anon','public.__dth_m11e_r3c_fn()','EXECUTE'),
    'authenticated_effective', has_function_privilege('authenticated','public.__dth_m11e_r3c_fn()','EXECUTE'),
    'service_role_effective', has_function_privilege('service_role','public.__dth_m11e_r3c_fn()','EXECUTE'),
    'acl_mentions_anon', COALESCE((
      SELECT p.proacl::text LIKE '%anon=%'
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='__dth_m11e_r3c_fn'
    ), false),
    'acl_mentions_authenticated', COALESCE((
      SELECT p.proacl::text LIKE '%authenticated=%'
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='__dth_m11e_r3c_fn'
    ), false),
    'acl_mentions_service_role', COALESCE((
      SELECT p.proacl::text LIKE '%service_role=%'
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='__dth_m11e_r3c_fn'
    ), false)
  ),
  'private_fn', jsonb_build_object(
    'proacl', (SELECT p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='ops' AND p.proname='__dth_m11e_r3c_fn'),
    'public_execute', has_function_privilege('public','ops.__dth_m11e_r3c_fn()','EXECUTE'),
    'schema_usage', jsonb_build_object(
      'anon', has_schema_privilege('anon','ops','USAGE'),
      'authenticated', has_schema_privilege('authenticated','ops','USAGE'),
      'service_role', has_schema_privilege('service_role','ops','USAGE')
    ),
    'effective_execute', jsonb_build_object(
      'anon', has_function_privilege('anon','ops.__dth_m11e_r3c_fn()','EXECUTE'),
      'authenticated', has_function_privilege('authenticated','ops.__dth_m11e_r3c_fn()','EXECUTE'),
      'service_role', has_function_privilege('service_role','ops.__dth_m11e_r3c_fn()','EXECUTE')
    )
  )
) AS r3c_results;

ROLLBACK;
