-- SegmiQ Sales Copilot
-- Actionable suggestions are company-scoped work items projected into Tasks.
-- Follow-ups stay on leads.follow_up_date. Quotations stay on quotations.

alter table public.clients
  add column if not exists copilot_contact_later_days smallint not null default 7,
  add column if not exists copilot_checkin_offset_days smallint not null default 1;

alter table public.clients
  drop constraint if exists clients_copilot_contact_later_days_check;
alter table public.clients
  add constraint clients_copilot_contact_later_days_check
  check (copilot_contact_later_days between 1 and 90);

alter table public.clients
  drop constraint if exists clients_copilot_checkin_offset_days_check;
alter table public.clients
  add constraint clients_copilot_checkin_offset_days_check
  check (copilot_checkin_offset_days between 1 and 30);

comment on column public.clients.copilot_contact_later_days is
  'Suggested check-in delay when a customer is comparing options and gave no date.';
comment on column public.clients.copilot_checkin_offset_days is
  'Days after a customer promised to reply before a salesperson check-in is suggested.';

alter table public.quotations
  add column if not exists copilot_fingerprint text;

alter table public.quotations
  drop constraint if exists quotations_creation_source_check;

alter table public.quotations
  add constraint quotations_creation_source_check
  check (creation_source in ('MANUAL', 'SALES_AGENT', 'CUSTOMER_AGENT', 'IMPORT', 'SALES_COPILOT'));

create table if not exists public.sales_copilot_analyses (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null check (status in ('pending', 'succeeded', 'degraded', 'failed')),
  context_revision text not null,
  summary text,
  facts jsonb not null default '{}'::jsonb,
  last_message_id text,
  last_message_at timestamptz,
  error text,
  model text,
  updated_at timestamptz not null default now()
);

create index if not exists sales_copilot_analyses_client_idx
  on public.sales_copilot_analyses (client_id, updated_at desc);

create table if not exists public.sales_copilot_work_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  deal_id uuid,
  owner_id uuid,
  action_type text not null,
  queue text not null,
  title text not null,
  explanation text not null,
  evidence_message_ids jsonb not null default '[]'::jsonb,
  related_record_ids jsonb not null default '{}'::jsonb,
  proposed_payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  missing_information jsonb not null default '[]'::jsonb,
  linked_quotation_id uuid,
  linked_follow_up boolean not null default false,
  review_status text not null default 'pending',
  execution_status text not null default 'none',
  fulfilment_status text not null default 'open',
  waiting_actor text,
  proposed_at timestamptz,
  hour_suggested boolean not null default false,
  current_due_at timestamptz,
  snooze_until timestamptz,
  context_revision text not null,
  semantic_key text not null,
  priority text not null default 'medium',
  execution_error text,
  audit jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_copilot_work_items_queue_check
    check (queue in ('needs_review', 'todo', 'waiting')),
  constraint sales_copilot_work_items_review_check
    check (review_status in ('pending', 'approved', 'dismissed', 'snoozed', 'stale')),
  constraint sales_copilot_work_items_execution_check
    check (execution_status in ('none', 'running', 'succeeded', 'failed')),
  constraint sales_copilot_work_items_fulfilment_check
    check (fulfilment_status in ('open', 'fulfilled', 'obsolete')),
  constraint sales_copilot_work_items_priority_check
    check (priority in ('high', 'medium', 'low'))
);

create index if not exists sales_copilot_work_items_owner_idx
  on public.sales_copilot_work_items (owner_id, fulfilment_status, review_status, proposed_at);

create index if not exists sales_copilot_work_items_lead_idx
  on public.sales_copilot_work_items (client_id, lead_id, updated_at desc);

create unique index if not exists sales_copilot_work_items_open_key
  on public.sales_copilot_work_items (client_id, lead_id, semantic_key)
  where fulfilment_status = 'open'
    and (
      review_status in ('pending', 'snoozed')
      or (review_status = 'approved' and execution_status = 'failed')
    );

create table if not exists public.sales_copilot_jobs (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  run_after timestamptz not null,
  status text not null default 'scheduled',
  reason text,
  generation integer not null default 1,
  coalesce_count integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint sales_copilot_jobs_status_check
    check (status in ('scheduled', 'running', 'done', 'failed'))
);

create index if not exists sales_copilot_jobs_due_idx
  on public.sales_copilot_jobs (run_after)
  where status = 'scheduled';

alter table public.sales_copilot_analyses enable row level security;
alter table public.sales_copilot_work_items enable row level security;
alter table public.sales_copilot_jobs enable row level security;

comment on table public.sales_copilot_work_items is
  'Canonical Sales Copilot work. Chat and Tasks project this row; they do not keep separate copies.';
