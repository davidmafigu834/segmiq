-- Phase 6.1: Shared DB-backed rate limit buckets (auth / public ingest abuse control).
-- Service role only — no anon/authenticated policies.

create table if not exists public.security_rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

comment on table public.security_rate_limits is
  'Sliding fixed-window counters for security rate limits (login, forgot-password, external leads). Written by service role only.';

alter table public.security_rate_limits enable row level security;

revoke all on table public.security_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.security_rate_limits to service_role;
