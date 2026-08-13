-- DTH-M11E-R3A disposable transactional engine proof
-- MUST ROLLBACK. Never place in supabase/migrations/.
-- OWNER_APPROVAL: APPROVE DTH-M11E-R3A STAGING TRANSACTIONAL GLOBAL ROUTINE DEFAULT TEST ONLY

BEGIN;

CREATE TEMP TABLE __r3a_meta (k text, v text);

INSERT INTO __r3a_meta
SELECT 'existing_fn_hash_before',
       md5(string_agg(x.line, E'\n' ORDER BY x.line))
FROM (
  SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||
         coalesce(p.proacl::text,'NULL')||'|'||pg_get_userbyid(p.proowner) AS line
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
) x;

INSERT INTO __r3a_meta
SELECT 'other_creator_defacl_before',
       md5(string_agg(x.line, E'\n' ORDER BY x.line))
FROM (
  SELECT r.rolname||'|'||COALESCE(n.nspname,'GLOBAL')||'|'||d.defaclobjtype::text||'|'||d.defaclacl::text AS line
  FROM pg_default_acl d
  JOIN pg_roles r ON r.oid=d.defaclrole
  LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
  WHERE r.rolname IN ('supabase_admin','supabase_auth_admin','supabase_storage_admin')
) x;

INSERT INTO __r3a_meta
SELECT 'postgres_global_fn_defacl_before',
       coalesce((
         SELECT d.defaclacl::text
         FROM pg_default_acl d
         JOIN pg_roles r ON r.oid=d.defaclrole
         WHERE r.rolname='postgres' AND d.defaclnamespace=0 AND d.defaclobjtype='f'
       ), 'NONE_EXPLICIT');

CREATE FUNCTION public.__dth_m11e_r3a_before_fn() RETURNS integer
  LANGUAGE sql AS $$ SELECT 1 $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON ROUTINES FROM PUBLIC;

INSERT INTO __r3a_meta
SELECT 'postgres_global_fn_defacl_after_candidate',
       coalesce((
         SELECT d.defaclacl::text
         FROM pg_default_acl d
         JOIN pg_roles r ON r.oid=d.defaclrole
         WHERE r.rolname='postgres' AND d.defaclnamespace=0 AND d.defaclobjtype='f'
       ), 'NONE_EXPLICIT');

CREATE FUNCTION public.__dth_m11e_r3a_after_fn() RETURNS integer
  LANGUAGE sql AS $$ SELECT 1 $$;
CREATE FUNCTION ops.__dth_m11e_r3a_after_fn() RETURNS integer
  LANGUAGE sql AS $$ SELECT 1 $$;

INSERT INTO __r3a_meta
SELECT 'existing_fn_hash_after',
       md5(string_agg(x.line, E'\n' ORDER BY x.line))
FROM (
  SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||
         coalesce(p.proacl::text,'NULL')||'|'||pg_get_userbyid(p.proowner) AS line
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
    AND p.proname NOT IN ('__dth_m11e_r3a_before_fn','__dth_m11e_r3a_after_fn')
) x;

INSERT INTO __r3a_meta
SELECT 'other_creator_defacl_after',
       md5(string_agg(x.line, E'\n' ORDER BY x.line))
FROM (
  SELECT r.rolname||'|'||COALESCE(n.nspname,'GLOBAL')||'|'||d.defaclobjtype::text||'|'||d.defaclacl::text AS line
  FROM pg_default_acl d
  JOIN pg_roles r ON r.oid=d.defaclrole
  LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
  WHERE r.rolname IN ('supabase_admin','supabase_auth_admin','supabase_storage_admin')
) x;

SELECT jsonb_build_object(
  'current_user', current_user::text,
  'meta', (SELECT jsonb_object_agg(k,v) FROM __r3a_meta),
  'before_fn', jsonb_build_object(
    'proacl', (SELECT p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='__dth_m11e_r3a_before_fn'),
    'effective_execute', jsonb_build_object(
      'public', has_function_privilege('public','public.__dth_m11e_r3a_before_fn()','EXECUTE'),
      'anon', has_function_privilege('anon','public.__dth_m11e_r3a_before_fn()','EXECUTE'),
      'authenticated', has_function_privilege('authenticated','public.__dth_m11e_r3a_before_fn()','EXECUTE'),
      'service_role', has_function_privilege('service_role','public.__dth_m11e_r3a_before_fn()','EXECUTE')
    )
  ),
  'after_public_fn', jsonb_build_object(
    'proacl', (SELECT p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='__dth_m11e_r3a_after_fn'),
    'effective_execute', jsonb_build_object(
      'public', has_function_privilege('public','public.__dth_m11e_r3a_after_fn()','EXECUTE'),
      'anon', has_function_privilege('anon','public.__dth_m11e_r3a_after_fn()','EXECUTE'),
      'authenticated', has_function_privilege('authenticated','public.__dth_m11e_r3a_after_fn()','EXECUTE'),
      'service_role', has_function_privilege('service_role','public.__dth_m11e_r3a_after_fn()','EXECUTE')
    )
  ),
  'after_private_fn', jsonb_build_object(
    'proacl', (SELECT p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops' AND p.proname='__dth_m11e_r3a_after_fn'),
    'schema_usage', jsonb_build_object(
      'anon', has_schema_privilege('anon','ops','USAGE'),
      'authenticated', has_schema_privilege('authenticated','ops','USAGE'),
      'service_role', has_schema_privilege('service_role','ops','USAGE')
    ),
    'effective_execute', jsonb_build_object(
      'public', has_function_privilege('public','ops.__dth_m11e_r3a_after_fn()','EXECUTE'),
      'anon', has_function_privilege('anon','ops.__dth_m11e_r3a_after_fn()','EXECUTE'),
      'authenticated', has_function_privilege('authenticated','ops.__dth_m11e_r3a_after_fn()','EXECUTE'),
      'service_role', has_function_privilege('service_role','ops.__dth_m11e_r3a_after_fn()','EXECUTE')
    )
  )
) AS r3a_results;

ROLLBACK;
