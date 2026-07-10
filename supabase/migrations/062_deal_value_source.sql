-- 062_deal_value_source.sql
-- Tracks whether deal_value came from a rep estimate or a client-facing proposal.

alter table public.leads
  add column if not exists deal_value_source text
    check (deal_value_source is null or deal_value_source in ('manual', 'proposal'));

comment on column public.leads.deal_value_source is
  'manual = rep estimate; proposal = auto-filled from sent/accepted quotation (locked against manual override)';
