-- 065_project_magazine_fields.sql
-- Magazine narrative, specs, timeline, cover photo, and PDF cache on projects

alter table public.projects
  add column if not exists cover_media_id uuid references public.project_media(id) on delete set null;

alter table public.projects
  add column if not exists story_brief text;

alter table public.projects
  add column if not exists story_result text;

alter table public.projects
  add column if not exists pull_quote text;

alter table public.projects
  add column if not exists pull_quote_by text;

alter table public.projects
  add column if not exists timeline_steps jsonb not null default '[]'::jsonb;

alter table public.projects
  add column if not exists spec_fields jsonb not null default '[]'::jsonb;

alter table public.projects
  add column if not exists pdf_url text;

alter table public.projects
  add column if not exists pdf_generated_at timestamptz;

create index if not exists idx_projects_cover_media_id
  on public.projects(cover_media_id);
