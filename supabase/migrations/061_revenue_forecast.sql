-- 061_revenue_forecast.sql
-- Additive: expected close date on leads + weekly forecast accuracy snapshots.
-- Forecast itself is computed live; this table only stores snapshot history.

-- ---------------------------------------------------------------------------
-- leads.expected_close_date — captured at quote / proposal stage.
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists expected_close_date date;

create index if not exists idx_leads_expected_close_date
  on public.leads (client_id, expected_close_date)
  where expected_close_date is not null
    and status not in ('WON', 'LOST', 'NOT_QUALIFIED');

-- ---------------------------------------------------------------------------
-- forecast_snapshots — weekly point-in-time forecast for month / quarter.
-- actual_value is filled once the period closes (backtested accuracy).
-- ---------------------------------------------------------------------------
create table if not exists public.forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,

  -- Calendar period being forecast (not rolling 7-day)
  period_type text not null check (period_type in ('month', 'quarter')),
  period_start date not null,
  period_end date not null,

  -- When this snapshot was taken (typically Monday of the cron week)
  snapshot_date date not null,

  -- Weighted forecast Σ(deal_value × stage_close_probability) for dated deals
  -- whose expected_close_date falls in this period
  forecasted_value numeric not null default 0,
  forecast_committed numeric not null default 0,
  forecast_best_case numeric not null default 0,
  forecast_pipeline numeric not null default 0,

  -- Undated open pipeline (excluded from forecasted_value; shown for visibility)
  undated_count integer not null default 0,
  undated_pipeline_value numeric not null default 0,

  open_deal_count integer not null default 0,
  methodology text not null default 'stage',

  -- Filled when period_end < today: sum of WON deal_value closed in the period
  actual_value numeric,

  created_at timestamptz not null default now()
);

create unique index if not exists forecast_snapshots_unique
  on public.forecast_snapshots (client_id, period_type, period_start, snapshot_date);

create index if not exists forecast_snapshots_client_period_idx
  on public.forecast_snapshots (client_id, period_type, period_start desc);

create index if not exists forecast_snapshots_pending_actual_idx
  on public.forecast_snapshots (period_end)
  where actual_value is null;

alter table public.forecast_snapshots enable row level security;
-- No policies: service-role + application-layer auth (canAccessClient), same as
-- client_intelligence_snapshots / performance_snapshots.
