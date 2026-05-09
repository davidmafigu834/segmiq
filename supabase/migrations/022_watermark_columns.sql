-- 022_watermark_columns.sql
-- Adds watermark tracking to project_media and logo storage key to clients

alter table public.project_media
  add column if not exists watermarked boolean default false;

alter table public.clients
  add column if not exists logo_key text;
