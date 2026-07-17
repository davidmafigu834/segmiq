-- Store R2 object key for WhatsApp media when public URL is unavailable at ingest time.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_storage_key text;
