-- Backs the public Status page with self-hosted health checks.
--   status_components : the things we monitor (website, CRM, Cloud, WhatsApp, etc.)
--   status_checks     : results written by a scheduled health-check job (Vercel Cron)
--   status_incidents  : human-written incident history, managed in the Agency Admin portal
-- The Status page is public, so it can READ all three. Only the cron job writes checks
-- (server-side), and only authenticated staff manage components/incidents.

create table if not exists public.status_components (
  key         text primary key,
  name        text not null,
  sort_order  int  not null default 0,
  enabled     boolean not null default true
);

create table if not exists public.status_checks (
  id             bigint generated always as identity primary key,
  component_key  text not null references public.status_components(key) on delete cascade,
  ok             boolean not null,
  latency_ms     int,
  checked_at     timestamptz not null default now()
);
create index if not exists status_checks_component_time_idx
  on public.status_checks (component_key, checked_at desc);

create table if not exists public.status_incidents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  body           text not null default '',
  severity       text not null default 'minor' check (severity in ('minor','major','critical')),
  component_key  text references public.status_components(key) on delete set null,
  started_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index if not exists status_incidents_started_idx on public.status_incidents (started_at desc);

alter table public.status_components enable row level security;
alter table public.status_checks     enable row level security;
alter table public.status_incidents  enable row level security;

drop policy if exists "status components public read" on public.status_components;
create policy "status components public read" on public.status_components for select using (true);

drop policy if exists "status checks public read" on public.status_checks;
create policy "status checks public read" on public.status_checks for select using (true);

drop policy if exists "status incidents public read" on public.status_incidents;
create policy "status incidents public read" on public.status_incidents for select using (true);

drop policy if exists "status components staff manage" on public.status_components;
create policy "status components staff manage" on public.status_components for all to authenticated using (true) with check (true);

drop policy if exists "status incidents staff manage" on public.status_incidents;
create policy "status incidents staff manage" on public.status_incidents for all to authenticated using (true) with check (true);

insert into public.status_components (key, name, sort_order) values
  ('website',   'Website (segmiq.com)', 1),
  ('crm',       'Segmiq CRM',           2),
  ('cloud',     'Segmiq Cloud',         3),
  ('forms',     'Lead capture & forms', 4),
  ('whatsapp',  'WhatsApp delivery',    5),
  ('email',     'Email delivery',       6),
  ('api',       'API',                  7),
  ('dashboards','Dashboards',           8)
on conflict (key) do nothing;
