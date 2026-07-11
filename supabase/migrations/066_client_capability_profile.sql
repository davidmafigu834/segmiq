-- 066_client_capability_profile.sql
-- Client-level company capability profile + per-project magazine toggle

alter table public.clients
  add column if not exists capability_tagline text;

alter table public.clients
  add column if not exists years_in_operation integer;

alter table public.clients
  add column if not exists industries_served text[];

alter table public.clients
  add column if not exists certifications jsonb not null default '[]'::jsonb;

alter table public.clients
  add column if not exists team_members jsonb not null default '[]'::jsonb;

alter table public.clients
  add column if not exists capability_stats jsonb not null default '[]'::jsonb;

alter table public.projects
  add column if not exists include_capability_section boolean not null default false;
