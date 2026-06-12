-- 050_leads_manual_priority.sql
-- Customer Hub: manual priority for manually-added leads that have no AI score.
-- Nullable; existing leads stay NULL. The no-AI lane sort reads this as a
-- ranking signal. Separate from leads.score (which the scoring pipeline owns).
-- Additive only.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS manual_priority text
  CHECK (manual_priority IN ('hot','warm','cold'));
