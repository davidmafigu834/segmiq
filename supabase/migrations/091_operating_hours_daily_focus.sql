-- 091_operating_hours_daily_focus.sql
-- Company / salesperson operating hours + daily focus completion log.
-- Hours live on sales_execution_settings so client baseline and salesperson override share one model.

alter table public.sales_execution_settings
  add column if not exists working_days smallint[],
  add column if not exists work_start_time time,
  add column if not exists work_end_time time;

alter table public.sales_execution_settings
  drop constraint if exists sales_execution_settings_working_days_check;

alter table public.sales_execution_settings
  add constraint sales_execution_settings_working_days_check
  check (
    working_days is null
    or (
      cardinality(working_days) between 1 and 7
      and working_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  );

comment on column public.sales_execution_settings.working_days is
  'JS weekday numbers 0=Sun … 6=Sat. Null inherits company baseline or Mon–Fri default.';
comment on column public.sales_execution_settings.work_start_time is
  'Local work start (company timezone). Null inherits.';
comment on column public.sales_execution_settings.work_end_time is
  'Local work end (company timezone). Null inherits.';

create table if not exists public.sales_daily_focus_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  salesperson_id uuid not null references public.users(id) on delete cascade,
  plan_date date not null,
  plan_complete boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_daily_focus_log is
  'One row per salesperson per plan date. Records whether the daily focus / plan was completed.';

create unique index if not exists sales_daily_focus_log_salesperson_date_uidx
  on public.sales_daily_focus_log (client_id, salesperson_id, plan_date);

create index if not exists sales_daily_focus_log_salesperson_date_idx
  on public.sales_daily_focus_log (salesperson_id, plan_date desc);

alter table public.sales_daily_focus_log enable row level security;
