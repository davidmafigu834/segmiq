-- Phase 2: SegmiQ user session registry + security events foundation
-- Additive only. Does not alter users.session_version.
-- WhatsApp QR connection sessions remain separate (whatsapp_connections).

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  session_type text not null check (session_type in ('WEB', 'MOBILE')),
  session_version integer not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  created_ip text,
  last_ip text,
  user_agent text,
  device_id text,
  device_name text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_user_sessions_user_id on public.user_sessions (user_id);
create index if not exists idx_user_sessions_expires_at on public.user_sessions (expires_at);
create index if not exists idx_user_sessions_revoked_at on public.user_sessions (revoked_at);
create index if not exists idx_user_sessions_user_active
  on public.user_sessions (user_id)
  where revoked_at is null;

comment on table public.user_sessions is
  'SegmiQ login sessions (web cookie / mobile bearer). Not WhatsApp QR sessions.';

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  session_id uuid references public.user_sessions(id) on delete set null,
  event_type text not null,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_events_user_id on public.security_events (user_id);
create index if not exists idx_security_events_created_at on public.security_events (created_at desc);
create index if not exists idx_security_events_type on public.security_events (event_type);

comment on table public.security_events is
  'Auth/security audit events. Never store passwords, JWTs, cookies, or integration tokens.';

alter table public.user_sessions enable row level security;
alter table public.security_events enable row level security;
