-- 089_sales_guided_learning.sql
-- SegmiQ Guided Learning (SegmiQ 2.0 interactive course) progress.
-- Training practice data is ephemeral client-side — never stored here.

create table if not exists public.sales_guided_learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  course_id text not null default 'segmiq-2',
  course_version text not null default '2.0',
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED')),
  current_lesson_id text,
  current_step_id text,
  completed_lesson_ids jsonb not null default '[]'::jsonb,
  skipped_lesson_ids jsonb not null default '[]'::jsonb,
  lesson_progress jsonb not null default '{}'::jsonb,
  welcome_dismissed_at timestamptz,
  auto_show_welcome boolean not null default true,
  dashboard_card_hidden boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id, course_id, course_version)
);

comment on table public.sales_guided_learning_progress is
  'Per-user SegmiQ Guided Learning progress. Practice scenarios are ephemeral and never written here.';

create index if not exists sales_guided_learning_progress_client_idx
  on public.sales_guided_learning_progress (client_id, status);

create index if not exists sales_guided_learning_progress_user_idx
  on public.sales_guided_learning_progress (user_id, course_id, course_version);

alter table public.sales_guided_learning_progress enable row level security;
