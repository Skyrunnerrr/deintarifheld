-- Phase 2 P0 closure — legal_hold + consume_rate_limit privilege hardening (additive).
-- No DROP/TRUNCATE of leads or career_applications.

alter table public.leads
  add column if not exists legal_hold boolean not null default false;

alter table public.career_applications
  add column if not exists legal_hold boolean not null default false;

comment on column public.leads.legal_hold is
  'Explicit legal hold. Soft-delete is NOT a legal hold. Never auto-set by application code.';
comment on column public.career_applications.legal_hold is
  'Explicit legal hold. Soft-delete is NOT a legal hold. Never auto-set by application code.';

comment on column public.leads.anonymized_at is
  'Set when payload/email PII were redacted/minimised. Not legal anonymisation. Distinct from soft-delete and from legal_hold.';
comment on column public.career_applications.anonymized_at is
  'Set when payload/email/full_name PII were redacted/minimised. Not legal anonymisation. Distinct from soft-delete and from legal_hold.';

-- Recreate as SECURITY INVOKER: service_role already has table rights (002/003).
-- search_path pins pg_catalog first and pg_temp last.
create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_kind text,
  p_window_seconds integer,
  p_max_hits integer
)
returns table(allowed boolean, hit_count integer, retry_after integer)
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  now_ts timestamptz := clock_timestamp();
  started timestamptz;
  hits integer;
  window_ivl interval;
begin
  if p_bucket_key is null or length(p_bucket_key) = 0
     or p_kind is null or length(p_kind) = 0
     or p_window_seconds is null or p_window_seconds < 1
     or p_max_hits is null or p_max_hits < 1 then
    allowed := false;
    hit_count := 0;
    retry_after := 60;
    return next;
    return;
  end if;

  window_ivl := make_interval(secs => p_window_seconds);

  insert into public.intake_rate_limits as t
    (bucket_key, kind, window_started_at, hit_count, updated_at)
  values
    (p_bucket_key, p_kind, now_ts, 1, now_ts)
  on conflict (bucket_key, kind)
  do update set
    window_started_at = case
      when t.window_started_at is null or now_ts - t.window_started_at >= window_ivl
      then now_ts
      else t.window_started_at
    end,
    hit_count = case
      when t.window_started_at is null or now_ts - t.window_started_at >= window_ivl
      then 1
      else t.hit_count + 1
    end,
    updated_at = now_ts
  returning t.window_started_at, t.hit_count
  into started, hits;

  allowed := hits <= p_max_hits;
  hit_count := hits;
  if allowed then
    retry_after := 0;
  else
    retry_after := greatest(
      1,
      ceil(extract(epoch from (started + window_ivl - now_ts)))::integer
    );
  end if;
  return next;
end;
$$;

comment on function public.consume_rate_limit(text, text, integer, integer) is
  'Atomic window init/increment/reset + limit check. SECURITY INVOKER; service_role execute only.';

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
