-- 057_whatsapp_per_client.sql
-- Each client company has its own WhatsApp business number.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS meta_whatsapp_display_number text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS meta_whatsapp_access_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_meta_wa_phone_id_unique
  ON clients (meta_whatsapp_phone_number_id)
  WHERE meta_whatsapp_phone_number_id IS NOT NULL;
