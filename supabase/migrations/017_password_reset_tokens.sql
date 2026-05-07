create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index if not exists password_reset_tokens_token_idx
  on public.password_reset_tokens(token);

create index if not exists password_reset_tokens_expires_idx
  on public.password_reset_tokens(expires_at);

alter table public.password_reset_tokens enable row level security;
