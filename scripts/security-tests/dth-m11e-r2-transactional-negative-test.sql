-- DTH-M11E-R2 disposable transactional negative test
-- MUST ROLLBACK. Never place in supabase/migrations/.
-- OWNER_APPROVAL: APPROVE DTH-M11E-R2 STAGING TRANSACTIONAL NEGATIVE TEST ONLY

BEGIN;

CREATE TABLE public.__dth_m11e_r2_table (id bigint);
CREATE SEQUENCE public.__dth_m11e_r2_seq;
CREATE FUNCTION public.__dth_m11e_r2_fn() RETURNS integer
  LANGUAGE sql
  AS $$ SELECT 1 $$;
CREATE TABLE ops.__dth_m11e_r2_private_table (id bigint);
CREATE FUNCTION ops.__dth_m11e_r2_private_fn() RETURNS integer
  LANGUAGE sql
  AS $$ SELECT 1 $$;

SELECT jsonb_build_object(
  'current_user', current_user::text,
  'session_user', session_user::text,
  'public_table', (
    SELECT jsonb_build_object(
      'relacl', c.relacl::text,
      'owner', pg_get_userbyid(c.relowner),
      'explicit', jsonb_build_object(
        'anon', (c.relacl::text LIKE '%anon=%'),
        'authenticated', (c.relacl::text LIKE '%authenticated=%'),
        'service_role', (c.relacl::text LIKE '%service_role=%')
      ),
      'effective', jsonb_build_object(
        'anon', jsonb_build_object(
          'SELECT', has_table_privilege('anon','public.__dth_m11e_r2_table','SELECT'),
          'INSERT', has_table_privilege('anon','public.__dth_m11e_r2_table','INSERT'),
          'UPDATE', has_table_privilege('anon','public.__dth_m11e_r2_table','UPDATE'),
          'DELETE', has_table_privilege('anon','public.__dth_m11e_r2_table','DELETE'),
          'TRUNCATE', has_table_privilege('anon','public.__dth_m11e_r2_table','TRUNCATE'),
          'REFERENCES', has_table_privilege('anon','public.__dth_m11e_r2_table','REFERENCES'),
          'TRIGGER', has_table_privilege('anon','public.__dth_m11e_r2_table','TRIGGER')
        ),
        'authenticated', jsonb_build_object(
          'SELECT', has_table_privilege('authenticated','public.__dth_m11e_r2_table','SELECT'),
          'INSERT', has_table_privilege('authenticated','public.__dth_m11e_r2_table','INSERT'),
          'UPDATE', has_table_privilege('authenticated','public.__dth_m11e_r2_table','UPDATE'),
          'DELETE', has_table_privilege('authenticated','public.__dth_m11e_r2_table','DELETE'),
          'TRUNCATE', has_table_privilege('authenticated','public.__dth_m11e_r2_table','TRUNCATE'),
          'REFERENCES', has_table_privilege('authenticated','public.__dth_m11e_r2_table','REFERENCES'),
          'TRIGGER', has_table_privilege('authenticated','public.__dth_m11e_r2_table','TRIGGER')
        ),
        'service_role', jsonb_build_object(
          'SELECT', has_table_privilege('service_role','public.__dth_m11e_r2_table','SELECT'),
          'INSERT', has_table_privilege('service_role','public.__dth_m11e_r2_table','INSERT'),
          'UPDATE', has_table_privilege('service_role','public.__dth_m11e_r2_table','UPDATE'),
          'DELETE', has_table_privilege('service_role','public.__dth_m11e_r2_table','DELETE'),
          'TRUNCATE', has_table_privilege('service_role','public.__dth_m11e_r2_table','TRUNCATE'),
          'REFERENCES', has_table_privilege('service_role','public.__dth_m11e_r2_table','REFERENCES'),
          'TRIGGER', has_table_privilege('service_role','public.__dth_m11e_r2_table','TRIGGER')
        )
      )
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='__dth_m11e_r2_table'
  ),
  'public_seq', (
    SELECT jsonb_build_object(
      'relacl', c.relacl::text,
      'owner', pg_get_userbyid(c.relowner),
      'explicit', jsonb_build_object(
        'anon', (c.relacl::text LIKE '%anon=%'),
        'authenticated', (c.relacl::text LIKE '%authenticated=%'),
        'service_role', (c.relacl::text LIKE '%service_role=%')
      ),
      'effective', jsonb_build_object(
        'anon', jsonb_build_object(
          'USAGE', has_sequence_privilege('anon','public.__dth_m11e_r2_seq','USAGE'),
          'SELECT', has_sequence_privilege('anon','public.__dth_m11e_r2_seq','SELECT'),
          'UPDATE', has_sequence_privilege('anon','public.__dth_m11e_r2_seq','UPDATE')
        ),
        'authenticated', jsonb_build_object(
          'USAGE', has_sequence_privilege('authenticated','public.__dth_m11e_r2_seq','USAGE'),
          'SELECT', has_sequence_privilege('authenticated','public.__dth_m11e_r2_seq','SELECT'),
          'UPDATE', has_sequence_privilege('authenticated','public.__dth_m11e_r2_seq','UPDATE')
        ),
        'service_role', jsonb_build_object(
          'USAGE', has_sequence_privilege('service_role','public.__dth_m11e_r2_seq','USAGE'),
          'SELECT', has_sequence_privilege('service_role','public.__dth_m11e_r2_seq','SELECT'),
          'UPDATE', has_sequence_privilege('service_role','public.__dth_m11e_r2_seq','UPDATE')
        )
      )
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='__dth_m11e_r2_seq'
  ),
  'public_fn', (
    SELECT jsonb_build_object(
      'proacl', p.proacl::text,
      'owner', pg_get_userbyid(p.proowner),
      'explicit', jsonb_build_object(
        'anon', (COALESCE(p.proacl::text,'') LIKE '%anon=%'),
        'authenticated', (COALESCE(p.proacl::text,'') LIKE '%authenticated=%'),
        'service_role', (COALESCE(p.proacl::text,'') LIKE '%service_role=%'),
        'public', (COALESCE(p.proacl::text,'') LIKE '%=X/%' OR COALESCE(p.proacl::text,'') LIKE '%public=%')
      ),
      'effective_execute', jsonb_build_object(
        'anon', has_function_privilege('anon','public.__dth_m11e_r2_fn()','EXECUTE'),
        'authenticated', has_function_privilege('authenticated','public.__dth_m11e_r2_fn()','EXECUTE'),
        'service_role', has_function_privilege('service_role','public.__dth_m11e_r2_fn()','EXECUTE'),
        'public', has_function_privilege('public','public.__dth_m11e_r2_fn()','EXECUTE')
      )
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='__dth_m11e_r2_fn'
  ),
  'private_table', (
    SELECT jsonb_build_object(
      'relacl', c.relacl::text,
      'schema_usage', jsonb_build_object(
        'anon', has_schema_privilege('anon','ops','USAGE'),
        'authenticated', has_schema_privilege('authenticated','ops','USAGE'),
        'service_role', has_schema_privilege('service_role','ops','USAGE')
      ),
      'schema_create', jsonb_build_object(
        'anon', has_schema_privilege('anon','ops','CREATE'),
        'authenticated', has_schema_privilege('authenticated','ops','CREATE'),
        'service_role', has_schema_privilege('service_role','ops','CREATE')
      ),
      'effective', jsonb_build_object(
        'anon', jsonb_build_object(
          'SELECT', has_table_privilege('anon','ops.__dth_m11e_r2_private_table','SELECT'),
          'INSERT', has_table_privilege('anon','ops.__dth_m11e_r2_private_table','INSERT'),
          'UPDATE', has_table_privilege('anon','ops.__dth_m11e_r2_private_table','UPDATE'),
          'DELETE', has_table_privilege('anon','ops.__dth_m11e_r2_private_table','DELETE')
        ),
        'authenticated', jsonb_build_object(
          'SELECT', has_table_privilege('authenticated','ops.__dth_m11e_r2_private_table','SELECT'),
          'INSERT', has_table_privilege('authenticated','ops.__dth_m11e_r2_private_table','INSERT'),
          'UPDATE', has_table_privilege('authenticated','ops.__dth_m11e_r2_private_table','UPDATE'),
          'DELETE', has_table_privilege('authenticated','ops.__dth_m11e_r2_private_table','DELETE')
        ),
        'service_role', jsonb_build_object(
          'SELECT', has_table_privilege('service_role','ops.__dth_m11e_r2_private_table','SELECT'),
          'INSERT', has_table_privilege('service_role','ops.__dth_m11e_r2_private_table','INSERT'),
          'UPDATE', has_table_privilege('service_role','ops.__dth_m11e_r2_private_table','UPDATE'),
          'DELETE', has_table_privilege('service_role','ops.__dth_m11e_r2_private_table','DELETE')
        )
      )
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='ops' AND c.relname='__dth_m11e_r2_private_table'
  ),
  'private_fn', (
    SELECT jsonb_build_object(
      'proacl', p.proacl::text,
      'schema_usage', jsonb_build_object(
        'anon', has_schema_privilege('anon','ops','USAGE'),
        'authenticated', has_schema_privilege('authenticated','ops','USAGE'),
        'service_role', has_schema_privilege('service_role','ops','USAGE')
      ),
      'effective_execute', jsonb_build_object(
        'anon', has_function_privilege('anon','ops.__dth_m11e_r2_private_fn()','EXECUTE'),
        'authenticated', has_function_privilege('authenticated','ops.__dth_m11e_r2_private_fn()','EXECUTE'),
        'service_role', has_function_privilege('service_role','ops.__dth_m11e_r2_private_fn()','EXECUTE'),
        'public', has_function_privilege('public','ops.__dth_m11e_r2_private_fn()','EXECUTE')
      )
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='ops' AND p.proname='__dth_m11e_r2_private_fn'
  )
) AS r2_results;

ROLLBACK;
