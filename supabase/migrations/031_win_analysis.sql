-- 031_win_analysis.sql
-- Win analysis: record what contributed to each won deal

create table if not exists win_analysis (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  salesperson_id uuid references users(id) on delete set null,
  salesperson_name text,

  -- Time metrics
  days_to_close integer,
  -- Number of days from lead creation to marked won

  -- Contact metrics
  total_calls integer default 0,
  calls_answered integer default 0,
  -- Count from call_logs for this lead

  -- Assets sent
  portfolio_sent boolean default false,
  projects_sent integer default 0,
  pricing_sent boolean default false,
  documents_sent integer default 0,
  custom_messages_sent integer default 0,
  -- Derived from lead_events DOCUMENT_SENT

  -- Deal details
  deal_value numeric,
  source text,
  -- Copied from lead at time of win

  -- Form data snapshot
  project_type text,
  budget_range text,

  created_at timestamptz default now()
);

create index if not exists win_analysis_client_id_idx
  on win_analysis(client_id, created_at desc);

create index if not exists win_analysis_salesperson_id_idx
  on win_analysis(salesperson_id);

alter table win_analysis enable row level security;
