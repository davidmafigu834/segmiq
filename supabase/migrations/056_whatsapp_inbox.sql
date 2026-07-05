-- 056_whatsapp_inbox.sql
-- Shared company WhatsApp inbox: per-client phone mapping, message store, inbound source.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS meta_whatsapp_phone_number_id text;

CREATE INDEX IF NOT EXISTS idx_clients_meta_wa_phone_id
  ON clients (meta_whatsapp_phone_number_id)
  WHERE meta_whatsapp_phone_number_id IS NOT NULL;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN ('LANDING_PAGE', 'FACEBOOK', 'MANUAL', 'REFERRAL', 'WHATSAPP_INBOUND'));

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider_id text,
  phone text NOT NULL,
  body text,
  message_type text NOT NULL DEFAULT 'text',
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text CHECK (status IS NULL OR status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_provider_id
  ON whatsapp_messages (provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_created
  ON whatsapp_messages (lead_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client_created
  ON whatsapp_messages (client_id, created_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'FOLLOW_UP_DUE', 'DEAL_WON', 'LEAD_FLAG',
    'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED'
  ));
