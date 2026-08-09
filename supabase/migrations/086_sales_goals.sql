-- 086_sales_goals.sql
-- Salesperson monthly goals (REVENUE_WON primary). Achieved is always derived from win_analysis.

create table if not exists public.sales_goals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  salesperson_id uuid not null references public.users(id) on delete cascade,
  goal_type text not null default 'REVENUE_WON'
    check (goal_type in ('REVENUE_WON', 'DEALS_WON', 'LEADS_CONVERTED')),
  target_value numeric not null check (target_value > 0),
  currency text not null default 'USD',
  period_type text not null default 'MONTHLY'
    check (period_type in ('MONTHLY')),
  period_start date not null,
  period_end date not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

comment on table public.sales_goals is
  'Salesperson targets. Achieved revenue is derived from win_analysis, not stored.';

create unique index if not exists sales_goals_one_active_per_period_idx
  on public.sales_goals (client_id, salesperson_id, goal_type, period_start)
  where status = 'ACTIVE';

create index if not exists sales_goals_salesperson_period_idx
  on public.sales_goals (salesperson_id, period_start desc);

create index if not exists sales_goals_client_salesperson_idx
  on public.sales_goals (client_id, salesperson_id, status);

alter table public.sales_goals enable row level security;
