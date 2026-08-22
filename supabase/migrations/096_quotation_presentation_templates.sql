-- Additive presentation-template columns. Does not rewrite historical quotations.

alter table public.quote_templates
  add column if not exists layout_key text,
  add column if not exists category text,
  add column if not exists presentation jsonb not null default '{}'::jsonb,
  add column if not exists field_schema jsonb not null default '[]'::jsonb,
  add column if not exists is_builtin boolean not null default false,
  add column if not exists builtin_key text,
  add column if not exists source_template_id uuid references public.quote_templates(id) on delete set null,
  add column if not exists layout_version integer not null default 1;

create unique index if not exists idx_quote_templates_client_builtin
  on public.quote_templates(client_id, builtin_key)
  where builtin_key is not null;

alter table public.quotations
  add column if not exists template_layout_key text,
  add column if not exists template_layout_version integer,
  add column if not exists template_fields jsonb not null default '{}'::jsonb,
  add column if not exists project_summary text,
  add column if not exists presentation_snapshot jsonb;

comment on column public.quotations.template_fields is
  'Template-specific project fields (e.g. solar site/metrics). Not global Deal columns.';
comment on column public.quotations.presentation_snapshot is
  'Frozen presentation + brand at send time so later template/logo edits do not rewrite historical documents.';
