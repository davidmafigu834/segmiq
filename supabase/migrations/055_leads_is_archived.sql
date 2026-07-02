-- 055_leads_is_archived.sql
-- Audience segments and lead archive flows filter on leads.is_archived;
-- the column was referenced in app code but never added to this table.

alter table public.leads
  add column if not exists is_archived boolean not null default false;

create index if not exists leads_client_archived_idx
  on public.leads (client_id, is_archived)
  where is_archived = false;

-- Fix predefined segment that referenced a non-existent QUALIFIED status.
update public.audience_segments
set filters = '[{"field": "status", "operator": "in", "value": ["CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"]}]'::jsonb,
    updated_at = now()
where predefined_key = 'contacted_not_converted';
