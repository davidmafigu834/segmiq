-- 033_lead_is_archived.sql
-- Ensure is_archived exists on leads with correct default and backfill NULLs

alter table public.leads
  add column if not exists is_archived boolean not null default false;

-- Backfill any rows that were inserted before the default was set
update public.leads set is_archived = false where is_archived is null;

-- Index for filtering non-archived leads
create index if not exists leads_is_archived_idx
  on public.leads(assigned_to_id, is_archived)
  where is_archived = false;
