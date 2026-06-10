-- Self-serve client onboarding: setup status, progress, token table.

alter table public.clients
  add column if not exists setup_status text not null default 'active'
  check (setup_status in ('pending', 'active'));

update public.clients set setup_status = 'active' where setup_status is null;

alter table public.clients
  add column if not exists owner_email text;

alter table public.clients
  add column if not exists country text;

alter table public.clients
  add column if not exists website text;

alter table public.clients
  add column if not exists onboarding_progress jsonb not null default '{}';

create table if not exists public.client_onboarding_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists client_onboarding_tokens_token_idx
  on public.client_onboarding_tokens(token);

create index if not exists client_onboarding_tokens_client_id_idx
  on public.client_onboarding_tokens(client_id);

create index if not exists client_onboarding_tokens_expires_idx
  on public.client_onboarding_tokens(expires_at);

alter table public.client_onboarding_tokens enable row level security;
