-- Phase 16: Timeline pinning + idempotent activity dedupe on lead_events

ALTER TABLE lead_events
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE INDEX IF NOT EXISTS idx_lead_events_pinned
  ON lead_events (lead_id, pinned_at DESC NULLS LAST)
  WHERE pinned_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_events_dedupe_key
  ON lead_events (client_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
