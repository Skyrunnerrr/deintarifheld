-- Phase 2 P0 remediation — atomic rate-limit consume + anonymised_at (additive).
-- No DROP/TRUNCATE of leads or career_applications.

alter table public.leads
  add column if not exists anonymized_at timestamptz;

alter table public.career_applications
  add column if not exists anonymized_at timestamptz;

comment on column public.leads.anonymized_at is
  'Set when payload/email PII were anonymised. Distinct from soft-delete/legal hold.';
comment on column public.career_applications.anonymized_at is
  'Set when payload/email/full_name PII were anonymised. Distinct from soft-delete/legal hold.';

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_kind text,
  p_window_seconds integer,
  p_max_hits integer
)
returns table(allowed boolean, hit_count integer, retry_after integer)
language plpgsql
security definer
set search_path = public
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
  'Atomic window init/increment/reset + limit check. service_role only.';

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
