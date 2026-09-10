-- Phase 6.1: optional CSP violation storage (app fails soft if missing)
create table if not exists public.csp_violation_reports (
  id uuid primary key default gen_random_uuid(),
  violated_directive text,
  blocked_uri text,
  document_uri text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_csp_violation_reports_created
  on public.csp_violation_reports (created_at desc);

alter table public.csp_violation_reports enable row level security;
