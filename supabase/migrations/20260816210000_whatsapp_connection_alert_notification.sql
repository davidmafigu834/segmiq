-- Allows SegmiQ to alert company managers when the business WhatsApp transport
-- needs their attention. Transport health is separate from CRM data: this only
-- adds a notification type, nothing about leads or conversations changes.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED'
  ));

-- Supports the throttle lookup that keeps repeated reconnect alerts from
-- spamming administrators during a flapping connection.
CREATE INDEX IF NOT EXISTS idx_whatsapp_connection_events_type_recent
  ON public.whatsapp_connection_events (connection_id, event_type, created_at DESC);
