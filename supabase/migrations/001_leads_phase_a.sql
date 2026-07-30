-- DeinTarifheld Phase A — leads + audit (automations / DSGVO retention)
-- Apply via Supabase SQL editor or: supabase db push

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_ref text not null unique,
  page_source text not null,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'spam', 'deleted')),
  payload jsonb not null default '{}'::jsonb,
  email text not null,
  firma text,
  consent_at timestamptz not null,
  source_page text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists leads_page_source_created_idx
  on public.leads (page_source, created_at desc);

create index if not exists leads_email_created_idx
  on public.leads (email, created_at desc);

create index if not exists leads_status_created_idx
  on public.leads (status, created_at desc);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_idx
  on public.audit_events (created_at desc);

create index if not exists audit_events_lead_id_idx
  on public.audit_events (lead_id);

alter table public.leads enable row level security;
alter table public.audit_events enable row level security;

-- Service role bypasses RLS; no public policies on purpose.
comment on table public.leads is 'DTH lead intake; write via service role only';
comment on table public.audit_events is 'DTH audit trail for DSGVO/automation';
