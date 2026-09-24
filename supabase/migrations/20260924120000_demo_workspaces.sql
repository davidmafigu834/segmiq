-- Demo workspaces keep CRM data out of production tables.
-- Mutations are disposable and only readable by the service role.

alter table public.clients
  add column if not exists workspace_mode text not null default 'production';

alter table public.clients
  drop constraint if exists clients_workspace_mode_check;

alter table public.clients
  add constraint clients_workspace_mode_check
  check (workspace_mode in ('production', 'demo'));

alter table public.clients
  add column if not exists demo_industry text;

alter table public.clients
  add column if not exists demo_scenario text;

create table if not exists public.demo_workspace_mutations (
  client_id uuid primary key references public.clients(id) on delete cascade,
  mutations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.demo_workspace_mutations enable row level security;
