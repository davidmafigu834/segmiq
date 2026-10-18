-- Buyer introduction decision audit and in-app notification link.
-- Additive only. Existing rows keep a null decided_by and decided_at.
-- A decided row with both nulls is a legacy decision made before this migration.
-- Do not backfill a reviewer or a timestamp.

ALTER TABLE real_estate_buyer_introductions
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE real_estate_buyer_introductions
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE real_estate_buyer_introductions
  ADD COLUMN IF NOT EXISTS decision_reason text;

COMMENT ON COLUMN real_estate_buyer_introductions.decided_by IS
  'User who accepted or declined. Null on pending rows, and null on decisions recorded before this column existed.';

COMMENT ON COLUMN real_estate_buyer_introductions.decided_at IS
  'When the decision was recorded. Null means the row is still pending, or the decision predates this column.';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS introduction_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_introduction_id
  ON public.notifications (introduction_id)
  WHERE introduction_id IS NOT NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE',
    'FOLLOW_UP_PREP', 'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT',
    'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE', 'PHOTO_UPLOADED', 'STORAGE_WARNING',
    'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT', 'AGENT_ALERT', 'INVENTORY_ALERT',
    'COMMERCIAL_IMPORT', 'LEARNING_ALERT', 'COMPLIANCE_ALERT', 'SALES_FOCUS_DIGEST',
    'SOCIAL_INBOX', 'WEEKLY_TEAM_REPORT', 'WORK_PROJECT_ALERT', 'BUYER_INTRODUCTION'
  ]));
