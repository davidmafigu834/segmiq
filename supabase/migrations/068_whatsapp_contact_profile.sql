-- 068_whatsapp_contact_profile.sql
-- WhatsApp contact identity + richer message metadata for Sales Hub.

alter table public.contacts
  add column if not exists whatsapp_profile_name text;

alter table public.contacts
  add column if not exists whatsapp_wa_id text;

alter table public.whatsapp_messages
  add column if not exists media_url text;

alter table public.whatsapp_messages
  add column if not exists media_mime_type text;

alter table public.whatsapp_messages
  add column if not exists media_caption text;
