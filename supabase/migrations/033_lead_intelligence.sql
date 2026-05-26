-- 033_lead_intelligence.sql
-- Structured AI-processed intelligence extracted from every lead submission
-- This is the data foundation for recommendations, segmentation, and audience exports

create table if not exists lead_intelligence (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,

  -- Intent classification
  -- What this prospect actually wants, in a standardised category
  -- Examples: residential_solar, commercial_roofing, new_build_residential,
  -- bathroom_renovation, electrical_installation, landscaping, etc.
  intent_category text,

  -- Intent subcategory — more specific classification
  -- Example: intent_category = residential_solar,
  -- intent_subcategory = battery_backup_focus
  intent_subcategory text,

  -- Urgency signal derived from form answers
  -- immediate: wants it done now or within 30 days
  -- soon: within 3 months
  -- planning: 3-12 months out
  -- exploring: no clear timeline, just researching
  urgency_level text check (
    urgency_level in ('immediate', 'soon', 'planning', 'exploring', 'unknown')
  ),

  -- Budget confidence
  -- confirmed: gave a specific number or range
  -- indicated: vague signal like "reasonable budget" or "not too expensive"
  -- unknown: no budget information at all
  budget_confidence text check (
    budget_confidence in ('confirmed', 'indicated', 'unknown')
  ),

  -- Normalised budget value in USD — best estimate from form answers
  -- NULL if no budget information was provided
  budget_estimate_usd numeric,

  -- Project specificity
  -- how clearly defined is what they want
  -- high: knows exactly what they want, gave specific details
  -- medium: has a general idea, some details missing
  -- low: vague, just exploring options
  project_specificity text check (
    project_specificity in ('high', 'medium', 'low', 'unknown')
  ),

  -- Decision maker signal
  -- is this person likely the one who makes the purchase decision
  -- derived from role mentioned, language used, etc.
  is_likely_decision_maker boolean,

  -- Property or business type if relevant
  -- residential, commercial, industrial, government, ngo
  property_type text,

  -- Location extracted and normalised from form answers
  -- Stored as plain text — city or area name
  location_extracted text,

  -- Tags — array of descriptive labels extracted from the lead
  -- Examples: ['first_time_buyer', 'replacing_existing', 'insurance_claim',
  --            'comparing_quotes', 'referred_by_friend', 'saw_on_facebook']
  tags text[] default '{}',

  -- Intent score — separate from engagement score
  -- This scores the quality of intent at submission time
  -- 0 to 100 based on specificity, urgency, budget, and decision maker signal
  -- High intent score = this person is serious and ready to buy
  intent_score integer default 0 check (
    intent_score >= 0 and intent_score <= 100
  ),

  -- Plain language summary of this lead
  -- 2-3 sentences written by AI describing who this person is
  -- and what they want. Shown to the salesperson on first open.
  lead_summary text,

  -- Raw AI output stored for debugging and reprocessing
  raw_ai_output jsonb default '{}',

  -- Processing metadata
  processed_at timestamptz default now(),
  processing_version integer default 1,
  -- Increment this when the processing logic changes
  -- so we can identify leads processed with old logic

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One intelligence record per lead
create unique index if not exists lead_intelligence_lead_id_unique
  on lead_intelligence(lead_id);

-- Indexes for segmentation queries
create index if not exists lead_intelligence_client_id_idx
  on lead_intelligence(client_id);

create index if not exists lead_intelligence_intent_category_idx
  on lead_intelligence(client_id, intent_category);

create index if not exists lead_intelligence_urgency_idx
  on lead_intelligence(client_id, urgency_level);

create index if not exists lead_intelligence_intent_score_idx
  on lead_intelligence(client_id, intent_score desc);

create index if not exists lead_intelligence_budget_idx
  on lead_intelligence(client_id, budget_estimate_usd);

-- RLS — service role bypasses, application enforces access
alter table lead_intelligence enable row level security;

-- ============================================
-- CLIENT INTELLIGENCE SUMMARY TABLE
-- Aggregated weekly snapshot per client
-- Used for recommendations and trend analysis
-- ============================================

create table if not exists client_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Week this snapshot covers
  week_start date not null,
  week_end date not null,

  -- Volume
  total_leads integer default 0,
  processed_leads integer default 0,

  -- Intent distribution
  -- jsonb map of intent_category -> count
  -- Example: {"residential_solar": 12, "commercial_roofing": 3}
  intent_distribution jsonb default '{}',

  -- Urgency distribution
  urgency_distribution jsonb default '{}',

  -- Budget signals
  avg_budget_estimate numeric,
  leads_with_budget integer default 0,

  -- Quality signals
  avg_intent_score numeric,
  high_intent_leads integer default 0,
  -- intent_score >= 70

  -- Top tags this week
  top_tags text[] default '{}',

  -- Dominant location this week
  top_location text,

  -- AI-generated insight for this week
  -- Plain language summary of patterns
  weekly_insight text,

  created_at timestamptz default now()
);

create unique index if not exists client_intelligence_snapshots_unique
  on client_intelligence_snapshots(client_id, week_start);

create index if not exists client_intelligence_snapshots_client_idx
  on client_intelligence_snapshots(client_id, week_start desc);

alter table client_intelligence_snapshots enable row level security;
