-- 024_video_support.sql
-- Add video support to project_media table

alter table public.project_media
  add column if not exists duration_seconds integer;

alter table public.project_media
  add column if not exists thumbnail_url text;

alter table public.project_media
  drop constraint if exists project_media_type_check;

alter table public.project_media
  add constraint project_media_type_check
  check (type in ('photo', 'video', 'video_url'));
