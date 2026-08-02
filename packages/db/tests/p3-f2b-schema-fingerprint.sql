-- Deterministic schema fingerprint source (normalized text rows)
\set ON_ERROR_STOP on

COPY (
  SELECT 'TABLE|' || table_schema || '.' || table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY 1
) TO STDOUT;

COPY (
  SELECT 'COLUMN|' || table_name || '|' || column_name || '|' || data_type || '|' ||
         COALESCE(column_default,'') || '|' || is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
) TO STDOUT;

COPY (
  SELECT 'CONSTRAINT|' || c.conname || '|' || c.contype || '|' ||
         pg_get_constraintdef(c.oid)
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
  ORDER BY 1
) TO STDOUT;

COPY (
  SELECT 'INDEX|' || indexname || '|' || indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY 1
) TO STDOUT;

COPY (
  SELECT 'RLS|' || c.relname || '|' || c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY 1
) TO STDOUT;

COPY (
  SELECT 'POLICY|' || schemaname || '|' || tablename || '|' || policyname || '|' ||
         permissive || '|' || roles::text || '|' || cmd || '|' || COALESCE(qual,'') || '|' || COALESCE(with_check,'')
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY 1
) TO STDOUT;

COPY (
  SELECT 'GRANT|' || table_name || '|' || grantee || '|' || privilege_type || '|' || is_grantable
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
  ORDER BY 1
) TO STDOUT;
