-- 035_performance_intelligence.sql
-- Performance intelligence and recommendations engine
-- Analyses patterns across leads, calls, wins, and intelligence data
-- to produce specific actionable recommendations for each client

-- ============================================
-- CLIENT RECOMMENDATIONS TABLE
-- Stores AI-generated recommendations per client
-- Persisted so they are visible without waiting
-- for the next cron run
-- ============================================

create table if not exists client_recommendations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Recommendation category
  -- creative: suggests changes to ad creatives or messaging
  -- response_time: team is calling too slowly
  -- call_quality: high answer rate but low conversion
  -- follow_up: leads going stale without follow-up
  -- lead_quality: source producing low quality leads
  -- send_assets: team not using the send panel enough
  -- salesperson: specific salesperson needs coaching
  -- pricing: pricing signals from intelligence data
  -- segment: audience segment insight
  category text not null check (
    category in (
      'creative',
      'response_time',
      'call_quality',
      'follow_up',
      'lead_quality',
      'send_assets',
      'salesperson',
      'pricing',
      'segment'
    )
  ),

  -- Priority
  -- critical: blocking revenue — act today
  -- high: significant impact — act this week
  -- medium: meaningful improvement — act this month
  -- low: nice to have
  priority text not null default 'medium' check (
    priority in ('critical', 'high', 'medium', 'low')
  ),

  -- The recommendation itself — plain language, specific
  -- Written by Claude. Under 100 words.
  title text not null,
  body text not null,

  -- The data that triggered this recommendation
  -- Stored so the user can see what the numbers are
  supporting_data jsonb default '{}',
  -- Example:
  -- {
  --   "facebook_contact_rate": 12,
  --   "referral_contact_rate": 68,
  --   "avg_response_time_hours": 6.2
  -- }

  -- Specific salesperson this recommendation is about
  -- NULL if it is about the whole team or system
  about_salesperson_id uuid references users(id) on delete set null,
  about_salesperson_name text,

  -- Status
  -- active: visible and actionable
  -- dismissed: manually dismissed by the agency admin
  -- resolved: marked as resolved
  status text default 'active' check (
    status in ('active', 'dismissed', 'resolved')
  ),

  dismissed_at timestamptz,
  resolved_at timestamptz,

  -- When this recommendation was generated
  generated_at timestamptz default now(),

  -- Deduplication key — prevents the same recommendation
  -- from being generated twice in the same week
  -- Hash of client_id + category + key signal
  dedup_key text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists client_recommendations_client_idx
  on client_recommendations(client_id, status, priority);

create index if not exists client_recommendations_dedup_idx
  on client_recommendations(client_id, dedup_key)
  where dedup_key is not null;

alter table client_recommendations enable row level security;

-- ============================================
-- PERFORMANCE SNAPSHOTS TABLE
-- Weekly computed metrics per client
-- Used as the data input for recommendations
-- ============================================

create table if not exists performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Week this snapshot covers
  week_start date not null,
  week_end date not null,

  -- Volume metrics
  total_leads integer default 0,
  new_leads integer default 0,

  -- Contact metrics
  contact_rate_pct numeric,
  -- percentage of leads contacted this week
  avg_response_time_hours numeric,
  -- average hours from lead creation to first call

  -- Source breakdown
  -- jsonb map of source -> {count, contact_rate}
  source_performance jsonb default '{}',

  -- Salesperson breakdown
  -- jsonb map of salesperson_id -> {name, assigned, contacted, won, calls_logged, sends, avg_response_hours}
  salesperson_performance jsonb default '{}',

  -- Send panel usage
  assets_sent_total integer default 0,
  assets_sent_per_lead numeric,

  -- Stale leads
  stale_lead_count integer default 0,
  stale_lead_pct numeric,

  -- Conversion metrics
  deals_won integer default 0,
  win_rate_pct numeric,
  avg_days_to_close numeric,

  -- Intelligence quality
  avg_intent_score numeric,
  high_intent_leads integer default 0,
  high_intent_contact_rate numeric,

  -- Follow-up compliance
  leads_with_followup_pct numeric,
  overdue_followups integer default 0,

  created_at timestamptz default now()
);

create unique index if not exists performance_snapshots_unique
  on performance_snapshots(client_id, week_start);

create index if not exists performance_snapshots_client_idx
  on performance_snapshots(client_id, week_start desc);

alter table performance_snapshots enable row level security;
