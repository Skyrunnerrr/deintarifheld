-- DeinTarifheld Phase B — additive lead_type / mail metadata + career_applications
-- LOCAL validation only in this workstream. Remote apply is forbidden until Noah authorizes.
-- Rollback notes:
--   1) drop table public.career_applications cascade;
--   2) drop index if exists leads_lead_type_created_idx;
--   3) alter table public.leads drop column if exists lead_type, mail_status, mail_mode, mail_sent_at;
-- No DROP of Phase A tables. No bulk wipe. No remote reset.

-- ─── leads: additive columns ────────────────────────────────────────────────

alter table public.leads
  add column if not exists lead_type text;

alter table public.leads
  add column if not exists mail_status text;

alter table public.leads
  add column if not exists mail_mode text;

alter table public.leads
  add column if not exists mail_sent_at timestamptz;

-- Backfill business rows safely (idempotent)
update public.leads
set lead_type = 'business_energy'
where page_source = 'unternehmen'
  and (lead_type is null or lead_type = '');

update public.leads
set lead_type = 'private_energy'
where page_source in ('hero-funnel', 'main_funnel', 'privat')
  and (lead_type is null or lead_type = '');

comment on column public.leads.lead_type is
  'Machine-readable channel: business_energy | private_energy (career uses career_applications)';
comment on column public.leads.mail_status is
  'accepted | failed | skipped | mock (additive; API also returns mail boolean)';
comment on column public.leads.mail_mode is
  'mock | live | fail';

create index if not exists leads_lead_type_created_idx
  on public.leads (lead_type, created_at desc);

-- Soft CHECK via comment only (avoid breaking unexpected historical values).
-- Allowed page_source values going forward:
--   unternehmen | hero-funnel | main_funnel | privat

-- ─── career_applications (separate from energy leads) ───────────────────────

create table if not exists public.career_applications (
  id uuid primary key default gen_random_uuid(),
  application_ref text not null unique,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'spam', 'deleted')),
  payload jsonb not null default '{}'::jsonb,
  email text not null,
  full_name text,
  consent_at timestamptz not null,
  source_page text,
  idempotency_key text unique,
  mail_status text,
  mail_mode text,
  mail_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists career_applications_email_created_idx
  on public.career_applications (email, created_at desc);

create index if not exists career_applications_status_created_idx
  on public.career_applications (status, created_at desc);

alter table public.career_applications enable row level security;

comment on table public.career_applications is
  'DTH career applications; service role only; no file/CV storage in Phase B';

-- Extend audit_events with optional career reference (additive, nullable)
alter table public.audit_events
  add column if not exists career_id uuid references public.career_applications (id) on delete set null;

create index if not exists audit_events_career_id_idx
  on public.audit_events (career_id);

-- Service role must have table DML privileges on local/fresh applies.
-- RLS remains enabled with no public policies; anon/authenticated stay without arwd.
grant select, insert, update, delete on table public.leads to service_role;
grant select, insert, update, delete on table public.audit_events to service_role;
grant select, insert, update, delete on table public.career_applications to service_role;
