-- Onboarding tracking per user
alter table public.users add column if not exists onboarding_completed boolean default false;
alter table public.users add column if not exists onboarding_step integer default 0;

-- Plan column for clients
alter table public.clients add column if not exists
  plan text default 'free'
  check (plan in ('free', 'professional', 'business', 'enterprise'));

-- Watermark settings in client_profiles
alter table public.client_profiles add column if not exists watermark_enabled boolean default false;
alter table public.client_profiles add column if not exists
  watermark_position text default 'bottom-right'
  check (watermark_position in ('bottom-right', 'bottom-left', 'bottom-center', 'center'));
alter table public.client_profiles add column if not exists
  watermark_opacity integer default 40
  check (watermark_opacity between 10 and 90);
alter table public.client_profiles add column if not exists
  watermark_size text default 'small'
  check (watermark_size in ('small', 'medium', 'large'));

-- Project views table (for analytics)
create table if not exists public.project_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  visitor_id text,
  viewed_at timestamptz default now(),
  referrer text
);

create index if not exists project_views_project_id_idx on public.project_views(project_id);
create index if not exists project_views_viewed_at_idx on public.project_views(viewed_at);
create index if not exists project_views_client_id_idx on public.project_views(client_id);

alter table public.project_views enable row level security;

create policy "project_views_public_insert" on public.project_views
  for insert to anon with check (true);

-- Source column for notifications (agency vs cloud)
alter table public.notifications add column if not exists source text default 'agency';

-- Extend notifications type constraint to include cloud-specific types
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'NEW_LEAD', 'FOLLOW_UP_DUE', 'DEAL_WON', 'LEAD_FLAG',
    'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED'
  ));
