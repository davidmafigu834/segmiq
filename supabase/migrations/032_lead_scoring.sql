-- 032_lead_scoring.sql
-- Lead scoring system

alter table leads
  add column if not exists score integer default 0 check (score >= 0 and score <= 100);

alter table leads
  add column if not exists score_updated_at timestamptz;

alter table leads
  add column if not exists score_breakdown jsonb default '{}';
-- Stores what contributed to the score:
-- { recency: 20, calls: 15, assets_sent: 10, status_progress: 25, budget: 15, source: 15 }

alter table leads
  add column if not exists is_stale boolean default false;

alter table leads
  add column if not exists stale_since timestamptz;

-- Index for finding leads by score
create index if not exists leads_score_idx
  on leads(client_id, score desc);

create index if not exists leads_stale_idx
  on leads(client_id, is_stale)
  where is_stale = true;
