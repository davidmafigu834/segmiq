-- Salesperson dashboard visit boundary for "while you were away".
-- Reading the dashboard does not mark messages or notifications read.

create table if not exists public.sales_dashboard_visits (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  since_at timestamptz,
  visit_id uuid not null,
  visit_started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

comment on table public.sales_dashboard_visits is
  'Company- and user-scoped cursor for the salesperson daily workspace. Does not change message or notification read state.';

alter table public.sales_dashboard_visits enable row level security;
