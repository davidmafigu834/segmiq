-- 034_audience_segments.sql
-- Audience segments for Facebook retargeting and lookalike audiences
-- Each segment defines a filter set that produces a list of contacts
-- ready to upload to Meta Ads Manager

create table if not exists audience_segments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Segment identity
  name text not null,
  description text,

  -- Segment type
  -- predefined: one of the built-in segments that cannot be deleted
  -- custom: created by the agency admin with custom filters
  segment_type text not null default 'custom' check (
    segment_type in ('predefined', 'custom')
  ),

  -- Predefined segment key — null for custom segments
  -- Values: won_customers, contacted_not_converted,
  --         never_answered, high_budget_unconverted,
  --         immediate_urgency, high_intent
  predefined_key text,

  -- Filter definition stored as jsonb
  -- Each filter has: field, operator, value
  -- Fields: status, source, score, intent_score, urgency_level,
  --         intent_category, budget_estimate_usd, tags,
  --         property_type, is_stale, created_at, days_since_contact
  -- Operators: eq, neq, gt, gte, lt, lte, in, not_in,
  --            contains, date_after, date_before
  -- Example:
  -- [
  --   {"field": "status", "operator": "eq", "value": "WON"},
  --   {"field": "score", "operator": "gte", "value": 60}
  -- ]
  filters jsonb default '[]',

  -- Logic — and or or
  filter_logic text default 'and' check (filter_logic in ('and', 'or')),

  -- Export settings
  -- Which contact fields to include in the CSV export
  -- Meta accepts: phone, email, name, city, country
  export_fields text[] default '{phone,email,name}',

  -- Minimum score threshold — only include leads above this score
  -- Null means no minimum
  min_score integer,

  -- Date range — only include leads created within this many days
  -- Null means all time
  date_range_days integer,

  -- Metadata
  is_active boolean default true,
  last_exported_at timestamptz,
  last_export_count integer,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists audience_segments_client_id_idx
  on audience_segments(client_id, is_active);

create index if not exists audience_segments_predefined_idx
  on audience_segments(client_id, predefined_key)
  where predefined_key is not null;

alter table audience_segments enable row level security;

-- ============================================
-- EXPORT HISTORY
-- Track every export for audit purposes
-- ============================================

create table if not exists audience_export_history (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references audience_segments(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  exported_by uuid references users(id) on delete set null,
  exported_by_name text,

  -- How many contacts were in this export
  contact_count integer not null default 0,

  -- Which fields were exported
  fields_exported text[] default '{}',

  -- Purpose logged by the user
  -- retargeting, lookalike, exclusion, other
  export_purpose text,

  created_at timestamptz default now()
);

create index if not exists audience_export_history_segment_idx
  on audience_export_history(segment_id, created_at desc);

create index if not exists audience_export_history_client_idx
  on audience_export_history(client_id, created_at desc);

alter table audience_export_history enable row level security;
