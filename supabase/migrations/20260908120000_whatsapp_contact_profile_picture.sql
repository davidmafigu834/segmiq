-- Store durable WhatsApp contact profile picture URLs (R2 public URL).
-- Baileys CDN links expire; inbound ingest downloads and persists them.

alter table public.contacts
  add column if not exists whatsapp_profile_picture_url text;
