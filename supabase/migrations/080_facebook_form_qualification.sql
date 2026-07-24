-- Facebook Instant Form qualification: cached questions + client-defined answer→intent rules.

alter table public.clients
  add column if not exists fb_form_questions jsonb;

alter table public.clients
  add column if not exists fb_qualification_enabled boolean not null default false;

alter table public.clients
  add column if not exists fb_qualification_rules jsonb;

comment on column public.clients.fb_form_questions is
  'Cached Meta leadgen form questions from Graph API ({ key, label, type, options[] }).';

comment on column public.clients.fb_qualification_enabled is
  'When true, new Facebook leads are scored from fb_qualification_rules against form answers.';

comment on column public.clients.fb_qualification_rules is
  'Answer→score/tier rules: { thresholds, rules: [{ field_key, label, enabled, options: [{ value, points, force_tier }] }] }.';
