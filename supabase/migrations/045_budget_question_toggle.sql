-- Optional budget-range question on conversational lead form (OFF by default).
alter table public.form_schemas
  add column if not exists budget_question_enabled boolean not null default false;
