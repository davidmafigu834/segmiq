-- 054_instant_forms.sql
-- Facebook-style Instant Forms: multi-screen lead capture forms with their own
-- public URLs. Submissions flow into the existing leads pipeline.

create table if not exists public.instant_forms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null default 'Untitled form',
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  form_type text not null default 'more_volume'
    check (form_type in ('more_volume', 'higher_intent')),
  intro jsonb not null default '{}',
  questions jsonb not null default '[]',
  consents jsonb not null default '[]',
  privacy jsonb not null default '{}',
  completion jsonb not null default '{}',
  submission_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_instant_forms_client on public.instant_forms(client_id, created_at desc);
create index if not exists idx_instant_forms_slug on public.instant_forms(slug) where status = 'published';

alter table public.instant_forms enable row level security;
