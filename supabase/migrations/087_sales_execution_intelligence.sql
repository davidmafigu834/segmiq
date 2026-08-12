-- 087_sales_execution_intelligence.sql
-- Daily Sales Intelligence: opt-in execution settings + action state for idempotency/snooze/skip.
-- Plan itself is computed on read; these tables store configuration and UX state only.

-- ---------------------------------------------------------------------------
-- sales_execution_settings
-- ---------------------------------------------------------------------------
create table if not exists public.sales_execution_settings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- null salesperson_id = client baseline; non-null = salesperson override
  salesperson_id uuid references public.users(id) on delete cascade,
  daily_prospect_target integer check (daily_prospect_target is null or daily_prospect_target > 0),
  daily_call_target integer check (daily_call_target is null or daily_call_target > 0),
  daily_followup_target integer check (daily_followup_target is null or daily_followup_target > 0),
  daily_quote_target integer check (daily_quote_target is null or daily_quote_target > 0),
  daily_appointment_target integer check (daily_appointment_target is null or daily_appointment_target > 0),
  stage_inactivity_hours jsonb,
  quote_followup_hours integer check (quote_followup_hours is null or quote_followup_hours > 0),
  priority_weights jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_execution_settings is
  'Opt-in daily commitment targets and optional priority overrides. Null targets mean not configured.';

-- One client-level baseline
create unique index if not exists sales_execution_settings_client_baseline_uidx
  on public.sales_execution_settings (client_id)
  where salesperson_id is null;

-- One override per salesperson per client
create unique index if not exists sales_execution_settings_salesperson_uidx
  on public.sales_execution_settings (client_id, salesperson_id)
  where salesperson_id is not null;

create index if not exists sales_execution_settings_client_idx
  on public.sales_execution_settings (client_id);

alter table public.sales_execution_settings enable row level security;

-- ---------------------------------------------------------------------------
-- sales_action_states
-- ---------------------------------------------------------------------------
create table if not exists public.sales_action_states (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  salesperson_id uuid not null references public.users(id) on delete cascade,
  plan_date date not null,
  idempotency_key text not null,
  action_type text not null,
  reason_code text not null,
  source_entity_type text not null default 'lead'
    check (source_entity_type in ('lead', 'quotation', 'task', 'goal', 'none')),
  source_entity_id uuid,
  state text not null default 'active'
    check (state in ('active', 'completed', 'snoozed', 'skipped', 'resolved')),
  snoozed_until timestamptz,
  skip_reason text,
  completed_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_action_states is
  'Idempotent daily recommendation state (snooze/skip/complete/resolve). Does not duplicate lead data.';

create unique index if not exists sales_action_states_idempotency_uidx
  on public.sales_action_states (salesperson_id, plan_date, idempotency_key);

create index if not exists sales_action_states_salesperson_date_state_idx
  on public.sales_action_states (salesperson_id, plan_date, state);

create index if not exists sales_action_states_source_entity_idx
  on public.sales_action_states (source_entity_id, action_type)
  where source_entity_id is not null;

create index if not exists sales_action_states_client_salesperson_idx
  on public.sales_action_states (client_id, salesperson_id, plan_date desc);

alter table public.sales_action_states enable row level security;
