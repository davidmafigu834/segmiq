-- Sales Attention Engine Phase 2: persistent attention projections,
-- structured commitments, conversation summary cache, observability events,
-- and morning focus digest notifications.

-- ---------------------------------------------------------------------------
-- sales_attention_items (projection — not a parallel CRM object)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_attention_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  salesperson_id uuid not null references public.users(id) on delete cascade,

  customer_id uuid,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  conversation_id uuid,
  quotation_id uuid,
  task_id uuid,
  appointment_id uuid,
  commitment_id uuid,

  attention_type text not null,
  priority_class text not null
    check (priority_class in ('IMMEDIATE', 'TODAY', 'NEEDS_PROGRESS', 'WATCH')),
  title text not null,
  reason_code text not null,
  reason_summary text not null default '',
  suggested_action_type text,
  suggested_action_summary text,

  state text not null default 'OPEN'
    check (state in ('OPEN', 'SNOOZED', 'COMPLETED', 'DISMISSED', 'INVALIDATED')),
  due_at timestamptz,
  snoozed_until timestamptz,
  dismiss_reason text,

  source_event_id uuid,
  fingerprint text not null,
  internal_score integer not null default 0,
  enrichment jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  first_detected_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_attention_items is
  'Attention projection for Today''s Focus. Source of truth remains Tasks/Deals/Quotes/Conversations.';

create unique index if not exists sales_attention_items_fingerprint_uidx
  on public.sales_attention_items (client_id, salesperson_id, fingerprint);

create index if not exists sales_attention_items_salesperson_state_idx
  on public.sales_attention_items (client_id, salesperson_id, state, priority_class);

create index if not exists sales_attention_items_deal_idx
  on public.sales_attention_items (deal_id)
  where deal_id is not null;

create index if not exists sales_attention_items_lead_idx
  on public.sales_attention_items (lead_id)
  where lead_id is not null;

create index if not exists sales_attention_items_open_due_idx
  on public.sales_attention_items (salesperson_id, due_at)
  where state = 'OPEN';

alter table public.sales_attention_items enable row level security;

-- ---------------------------------------------------------------------------
-- sales_customer_commitments (structured customer + salesperson promises)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_customer_commitments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  conversation_id uuid,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid,
  deal_id uuid references public.deals(id) on delete set null,
  salesperson_id uuid references public.users(id) on delete set null,

  committed_by text not null
    check (committed_by in ('CUSTOMER', 'SALESPERSON')),
  commitment_type text not null default 'FOLLOW_UP',
  description text not null,
  due_at timestamptz,
  due_rule text,

  status text not null default 'OPEN'
    check (status in ('OPEN', 'COMPLETED', 'CANCELLED', 'SUPERSEDED')),

  source_message_id uuid,
  source_message_excerpt text,
  linked_task_follow_up_date date,
  fingerprint text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.sales_customer_commitments is
  'Structured commitments extracted from conversation or set explicitly. May link to lead follow_up_date.';

create unique index if not exists sales_customer_commitments_fingerprint_uidx
  on public.sales_customer_commitments (client_id, fingerprint);

create index if not exists sales_customer_commitments_open_due_idx
  on public.sales_customer_commitments (client_id, salesperson_id, status, due_at)
  where status = 'OPEN';

create index if not exists sales_customer_commitments_lead_idx
  on public.sales_customer_commitments (lead_id, status)
  where lead_id is not null;

alter table public.sales_customer_commitments enable row level security;

-- Link attention items → commitments (soft FK after both exist)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_attention_items_commitment_id_fkey'
  ) then
    alter table public.sales_attention_items
      add constraint sales_attention_items_commitment_id_fkey
      foreign key (commitment_id) references public.sales_customer_commitments(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- sales_conversation_summaries (cache; invalidate on new meaningful messages)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,

  customer_need text,
  important_requirements jsonb not null default '[]'::jsonb,
  what_happened text,
  customer_position text,
  open_questions jsonb not null default '[]'::jsonb,
  commitment text,
  recommended_context text,
  raw_summary text,

  source_message_count integer not null default 0,
  last_message_at timestamptz,
  content_fingerprint text not null,
  model text,
  generated_at timestamptz not null default now(),
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_conversation_summaries is
  'Cached grounded conversation summaries for Sales Attention enrichment. Invalidate when new meaningful messages arrive.';

create unique index if not exists sales_conversation_summaries_lead_uidx
  on public.sales_conversation_summaries (client_id, lead_id)
  where invalidated_at is null;

create index if not exists sales_conversation_summaries_lead_all_idx
  on public.sales_conversation_summaries (lead_id, generated_at desc);

alter table public.sales_conversation_summaries enable row level security;

-- ---------------------------------------------------------------------------
-- sales_attention_events (observability / quality)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_attention_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  salesperson_id uuid references public.users(id) on delete set null,
  attention_item_id uuid references public.sales_attention_items(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.sales_attention_events is
  'Quality/observability stream for Sales Attention (created, completed, drafted, etc.). No chain-of-thought.';

create index if not exists sales_attention_events_client_type_idx
  on public.sales_attention_events (client_id, event_type, created_at desc);

create index if not exists sales_attention_events_salesperson_idx
  on public.sales_attention_events (salesperson_id, created_at desc)
  where salesperson_id is not null;

alter table public.sales_attention_events enable row level security;

-- ---------------------------------------------------------------------------
-- Deal intentional wait (WAIT_UNTIL) — does not mutate stage
-- ---------------------------------------------------------------------------
alter table public.deals
  add column if not exists wait_until timestamptz,
  add column if not exists wait_reason text;

create index if not exists idx_deals_wait_until
  on public.deals (client_id, owner_id, wait_until)
  where wait_until is not null;

-- ---------------------------------------------------------------------------
-- Morning focus digest notification type
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT', 'AGENT_ALERT',
    'INVENTORY_ALERT', 'COMMERCIAL_IMPORT', 'LEARNING_ALERT', 'COMPLIANCE_ALERT',
    'SALES_FOCUS_DIGEST'
  ));

-- ---------------------------------------------------------------------------
-- sales_execution_settings: attention policy knobs
-- ---------------------------------------------------------------------------
alter table public.sales_execution_settings
  add column if not exists attention_config jsonb;

comment on column public.sales_execution_settings.attention_config is
  'Optional Sales Focus toggles: showCustomersWaiting, inactiveDealThresholdDays, etc.';
