-- 081_contacts_event_name.sql
-- Additive: optional event name for walk-in / trade-show captures
-- (e.g. "Mine Entra 2026") so event walk-ins are distinguishable from generic walk-ins.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS event_name text;

CREATE INDEX IF NOT EXISTS idx_contacts_client_event_name_created
  ON contacts (client_id, event_name, created_at DESC)
  WHERE event_name IS NOT NULL;
