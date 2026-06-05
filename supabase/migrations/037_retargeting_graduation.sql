-- 037_retargeting_graduation.sql
-- Retargeting audience lifecycle, agency tasks, and graduated-lead segment support.
-- Reversible: drop added objects; segment rows can remain (inactive).

-- Prior additive fields referenced by dashboard-data (no-op if already present)
alter table public.clients
  add column if not exists ai_enabled boolean not null default false;

create table if not exists public.campaign_qualifiers (
  client_id uuid primary key references public.clients(id) on delete cascade,
  budget_min numeric,
  budget_max numeric,
  target_service_types text[] default '{}',
  target_locations text[] default '{}',
  min_urgency text check (
    min_urgency is null or min_urgency in ('exploring', 'this_month', 'immediate')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.audience_segments
  add column if not exists min_age_days integer;

-- Per-client retargeting file lifecycle (status is derived in app code)
create table if not exists public.retargeting_audience_state (
  client_id uuid primary key references public.clients(id) on delete cascade,
  segment_id uuid references public.audience_segments(id) on delete set null,
  ad_live_at timestamptz,
  ad_live_by uuid references public.users(id) on delete set null,
  last_nudge_at timestamptz,
  banner_dismissed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agency work queue — one open retargeting task per client
create table if not exists public.agency_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  task_type text not null default 'retargeting_ad',
  title text not null,
  body text,
  status text not null default 'open' check (status in ('open', 'closed')),
  lead_count integer,
  last_nudged_at timestamptz,
  nudge_count integer not null default 0,
  supporting_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.users(id) on delete set null
);

create unique index if not exists agency_tasks_open_retargeting_unique
  on public.agency_tasks (client_id, task_type)
  where status = 'open' and task_type = 'retargeting_ad';

create index if not exists agency_tasks_client_status_idx
  on public.agency_tasks (client_id, status, created_at desc);

alter table public.retargeting_audience_state enable row level security;
alter table public.agency_tasks enable row level security;
alter table public.campaign_qualifiers enable row level security;
