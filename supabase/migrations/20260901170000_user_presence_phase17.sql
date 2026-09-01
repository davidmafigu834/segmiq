-- Phase 17: lightweight user presence / availability

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_override text
    CHECK (availability_override IS NULL OR availability_override IN ('AVAILABLE', 'AWAY', 'BUSY'));

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users (last_seen_at DESC NULLS LAST)
  WHERE last_seen_at IS NOT NULL;
