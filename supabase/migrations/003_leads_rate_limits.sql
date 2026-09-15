-- Phase 2 P0 — distributed intake/admin rate limits (additive, non-destructive).
-- Remote apply is an ops step. No drop/truncate of leads or career_applications.

create table if not exists public.intake_rate_limits (
  bucket_key text not null,
  kind text not null,
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket_key, kind)
);

alter table public.intake_rate_limits enable row level security;

comment on table public.intake_rate_limits is
  'Hashed intake/admin rate-limit buckets; service_role only; no PII';

grant select, insert, update, delete on table public.intake_rate_limits to service_role;

-- Rollback notes: drop table public.intake_rate_limits; (ops only, not applied by CI)
