-- 093_quotation_enterprise_workspace.sql
-- Enterprise quotation workspace: sections, line commercial fields, payment
-- terms, approval, timeline, activity events, company commercial guardrails.
-- Additive only — existing quotes remain valid.

-- ---------------------------------------------------------------------------
-- Status: internal approval + superseded (immutable history).
-- ---------------------------------------------------------------------------
alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations
  add constraint quotations_status_check
  check (status in (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'viewed',
    'accepted',
    'rejected',
    'expired',
    'superseded'
  ));

-- ---------------------------------------------------------------------------
-- Quotation commercial / workflow columns
-- ---------------------------------------------------------------------------
alter table public.quotations
  add column if not exists payment_terms_label text,
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb,
  add column if not exists delivery_terms text,
  add column if not exists warranty_terms text,
  add column if not exists commercial_notes text,
  add column if not exists customer_obligations text,
  add column if not exists sections jsonb not null default '[]'::jsonb,
  add column if not exists note_blocks jsonb not null default '[]'::jsonb,
  add column if not exists timeline_milestones jsonb not null default '[]'::jsonb,
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists approval_status text not null default 'not_required'
    check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  add column if not exists approval_required_reasons jsonb not null default '[]'::jsonb,
  add column if not exists approval_note text,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approval_requested_by_id uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_id uuid references public.users(id) on delete set null,
  add column if not exists revision_note text,
  add column if not exists declined_reason text;

comment on column public.quotations.sections is
  'Ordered section defs: [{id,title,sort_order,collapsed?}]. Line items use section_id.';
comment on column public.quotations.payment_schedule is
  'Structured payment rows: [{id,label,percent,amount,trigger,sort_order}].';
comment on column public.quotations.timeline_milestones is
  'Fulfilment milestones: [{id,title,due_date,sort_order,payment_percent?}].';
comment on column public.quotations.note_blocks is
  'Non-priced notes: [{id,title,body,sort_order,section_id?}].';

-- ---------------------------------------------------------------------------
-- Line item commercial snapshots (historically accurate)
-- ---------------------------------------------------------------------------
alter table public.quotation_line_items
  add column if not exists section_id text,
  add column if not exists unit text not null default 'Each',
  add column if not exists sku text,
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists tax_rate numeric,
  add column if not exists tax_inclusive boolean not null default false,
  add column if not exists is_optional boolean not null default false,
  add column if not exists option_group text,
  add column if not exists cost_price numeric,
  add column if not exists image_url text;

create index if not exists idx_quotation_line_items_section
  on public.quotation_line_items(quotation_id, section_id);

create index if not exists idx_quotation_line_items_optional
  on public.quotation_line_items(quotation_id, is_optional);

-- ---------------------------------------------------------------------------
-- Catalog enrichments for picker (optional; null-safe)
-- ---------------------------------------------------------------------------
alter table public.product_catalog
  add column if not exists sku text,
  add column if not exists unit text not null default 'Each',
  add column if not exists cost_price numeric,
  add column if not exists tax_rate numeric,
  add column if not exists image_url text,
  add column if not exists warranty text;

-- ---------------------------------------------------------------------------
-- Company commercial guardrails (quotation_settings)
-- ---------------------------------------------------------------------------
alter table public.quotation_settings
  add column if not exists default_currency text not null default 'USD',
  add column if not exists default_validity_days integer not null default 14,
  add column if not exists default_payment_terms text,
  add column if not exists max_discount_percent numeric not null default 10,
  add column if not exists min_margin_percent numeric,
  add column if not exists approval_value_threshold numeric,
  add column if not exists require_approval_above_discount boolean not null default true,
  add column if not exists supported_currencies jsonb not null default '["USD"]'::jsonb,
  add column if not exists salesperson_can_see_margin boolean not null default false,
  add column if not exists salesperson_can_see_cost boolean not null default false;

-- ---------------------------------------------------------------------------
-- Quotation activity (commercial audit — not UI noise)
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_events (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid,
  actor_id uuid references public.users(id) on delete set null,
  actor_name text not null default 'System',
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotation_events_quote
  on public.quotation_events(quotation_id, created_at desc);
create index if not exists idx_quotation_events_client
  on public.quotation_events(client_id, created_at desc);

alter table public.quotation_events enable row level security;

-- When a revision is sent, mark parent superseded (app logic also sets this).
-- Backfill: quotes with superseded_by_id that are still sent/viewed → leave as-is;
-- new sends will set status = superseded.
