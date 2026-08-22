-- 094_quotation_enterprise_phase2.sql
-- Commercial governance, approvals, packages, customer engagement, templates.
-- Additive only — Phase 1 quotations remain valid. Historical cost/margin is
-- left null where it cannot be determined.

-- ---------------------------------------------------------------------------
-- Catalog commercial fields
-- ---------------------------------------------------------------------------
alter table public.product_catalog
  add column if not exists min_selling_price numeric,
  add column if not exists item_kind text not null default 'product',
  add column if not exists requires_approval boolean not null default false;

do $$ begin
  alter table public.product_catalog
    add constraint product_catalog_item_kind_check
    check (item_kind in ('product', 'service'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Line item commercial snapshots + packages / options
-- ---------------------------------------------------------------------------
alter table public.quotation_line_items
  add column if not exists catalog_unit_price numeric,
  add column if not exists price_override boolean not null default false,
  add column if not exists package_id uuid,
  add column if not exists package_locked boolean not null default false,
  add column if not exists offer_option_id text,
  add column if not exists option_state text not null default 'available';

do $$ begin
  alter table public.quotation_line_items
    add constraint quotation_line_items_option_state_check
    check (option_state in ('available', 'selected', 'declined'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Company commercial policy (quotation_settings)
-- ---------------------------------------------------------------------------
alter table public.quotation_settings
  add column if not exists price_edit_policy text not null default 'discount_allowed',
  add column if not exists margin_warning_percent numeric,
  add column if not exists margin_visibility text not null default 'none',
  add column if not exists discount_authority jsonb not null default '[]'::jsonb,
  add column if not exists allow_quotation_discount boolean not null default true,
  add column if not exists salesperson_can_create_custom_item boolean not null default true,
  add column if not exists salesperson_can_create_package boolean not null default false,
  add column if not exists require_approval_for_custom_items boolean not null default false,
  add column if not exists customer_allow_accept boolean not null default true,
  add column if not exists customer_allow_request_changes boolean not null default true,
  add column if not exists customer_allow_ask_question boolean not null default true,
  add column if not exists customer_allow_decline boolean not null default true,
  add column if not exists customer_allow_option_selection boolean not null default true,
  add column if not exists require_acceptance_name boolean not null default false,
  add column if not exists require_acceptance_checkbox boolean not null default true,
  add column if not exists secure_link_ttl_days integer,
  add column if not exists brand_footer text,
  add column if not exists bank_details text,
  add column if not exists tax_registration text,
  add column if not exists legal_registration text;

do $$ begin
  alter table public.quotation_settings
    add constraint quotation_settings_price_edit_policy_check
    check (price_edit_policy in ('standard_only', 'discount_allowed', 'price_override', 'manager_controlled'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.quotation_settings
    add constraint quotation_settings_margin_visibility_check
    check (margin_visibility in ('none', 'health', 'percent', 'full'));
exception when duplicate_object then null;
end $$;

-- Backfill visibility from Phase 1 flags without inventing commercial history.
update public.quotation_settings
set margin_visibility = case
  when salesperson_can_see_cost then 'full'
  when salesperson_can_see_margin then 'percent'
  else 'none'
end
where margin_visibility = 'none'
  and (salesperson_can_see_cost or salesperson_can_see_margin);

-- ---------------------------------------------------------------------------
-- Quotations — engagement, acceptance snapshots, offer options
-- ---------------------------------------------------------------------------
alter table public.quotations
  add column if not exists commercial_fingerprint text,
  add column if not exists approval_snapshot jsonb,
  add column if not exists terms_snapshot text,
  add column if not exists view_count integer not null default 0,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists customer_response_type text,
  add column if not exists customer_response_category text,
  add column if not exists customer_response_message text,
  add column if not exists accepted_total numeric,
  add column if not exists accepted_snapshot jsonb,
  add column if not exists customer_configuration jsonb not null default '{}'::jsonb,
  add column if not exists link_revoked_at timestamptz,
  add column if not exists template_id uuid,
  add column if not exists offer_options jsonb not null default '[]'::jsonb,
  add column if not exists selected_offer_option_id text,
  add column if not exists accepted_by_name text,
  add column if not exists declined_category text;

comment on column public.quotations.customer_configuration is
  'Customer selections against an immutable sent version: selected optional ids, offer option, selected total.';
comment on column public.quotations.offer_options is
  'Optional commercial alternatives: [{id,label,description,is_recommended}]. Empty = single offer.';

-- Approval status: keep separate from quotation lifecycle.
alter table public.quotations drop constraint if exists quotations_approval_status_check;
alter table public.quotations
  add constraint quotations_approval_status_check
  check (approval_status in (
    'not_required',
    'required',
    'pending',
    'approved',
    'changes_requested',
    'rejected'
  ));

-- ---------------------------------------------------------------------------
-- Quote templates — structure + commercial defaults
-- ---------------------------------------------------------------------------
alter table public.quote_templates
  add column if not exists sections jsonb not null default '[]'::jsonb,
  add column if not exists note_blocks jsonb not null default '[]'::jsonb,
  add column if not exists payment_terms_label text,
  add column if not exists warranty_terms text,
  add column if not exists delivery_terms text,
  add column if not exists package_ids jsonb not null default '[]'::jsonb,
  add column if not exists customer_actions jsonb not null default '{}'::jsonb,
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists locked_terms boolean not null default false;

alter table public.quote_template_line_items
  add column if not exists section_id text,
  add column if not exists unit text not null default 'Each',
  add column if not exists sku text,
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists tax_rate numeric,
  add column if not exists is_optional boolean not null default false,
  add column if not exists package_id uuid,
  add column if not exists offer_option_id text;

-- ---------------------------------------------------------------------------
-- Approval policies (company-configurable, not hard-coded)
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_approval_policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  trigger_type text not null,
  operator text not null default 'gt',
  threshold_numeric numeric,
  threshold_text text,
  approver_role text,
  approver_user_id uuid references public.users(id) on delete set null,
  sequence_group integer not null default 1,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_approval_policies_trigger_check
    check (trigger_type in (
      'discount',
      'margin',
      'quotation_value',
      'payment_terms',
      'price_override',
      'special_product',
      'custom_item'
    )),
  constraint quotation_approval_policies_operator_check
    check (operator in ('gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'is_true', 'not_standard'))
);

create index if not exists idx_quote_approval_policies_client
  on public.quotation_approval_policies(client_id, is_active, priority);

-- ---------------------------------------------------------------------------
-- Approval requests — bound to a version snapshot, not a mutable quote
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_approval_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  revision_number integer not null default 1,
  status text not null default 'pending'
    check (status in (
      'pending',
      'approved',
      'changes_requested',
      'rejected',
      'invalidated',
      'cancelled'
    )),
  reason text,
  commercial_snapshot jsonb not null default '{}'::jsonb,
  triggered_rules jsonb not null default '[]'::jsonb,
  fingerprint text,
  requested_by_id uuid references public.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by_id uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_approval_requests_quote
  on public.quotation_approval_requests(quotation_id, created_at desc);
create index if not exists idx_quote_approval_requests_client_pending
  on public.quotation_approval_requests(client_id, status, requested_at desc);

create table if not exists public.quotation_approval_steps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quotation_approval_requests(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  sequence_group integer not null default 1,
  approver_role text,
  approver_user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested', 'rejected', 'skipped')),
  decided_by_id uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_approval_steps_request
  on public.quotation_approval_steps(request_id, sequence_group);

-- ---------------------------------------------------------------------------
-- Quotation packages (reusable commercial assemblies — not marketing packages)
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  pricing_model text not null default 'component_total'
    check (pricing_model in ('component_total', 'fixed', 'discounted_bundle')),
  flexibility text not null default 'flexible'
    check (flexibility in ('locked', 'flexible', 'quantity_adjustable')),
  fixed_price numeric,
  discount_percent numeric not null default 0,
  currency text not null default 'USD',
  notes text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotation_packages_client
  on public.quotation_packages(client_id, is_active);

create table if not exists public.quotation_package_components (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.quotation_packages(id) on delete cascade,
  catalog_item_id uuid references public.product_catalog(id) on delete set null,
  item_name text not null,
  description text,
  quantity numeric not null default 1,
  unit text not null default 'Each',
  unit_price numeric not null default 0,
  cost_price numeric,
  sku text,
  is_optional boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotation_package_components
  on public.quotation_package_components(package_id, sort_order);

alter table public.quotation_line_items
  drop constraint if exists quotation_line_items_package_id_fkey;
alter table public.quotation_line_items
  add constraint quotation_line_items_package_id_fkey
  foreign key (package_id) references public.quotation_packages(id) on delete set null;

alter table public.quotations
  drop constraint if exists quotations_template_id_fkey;
alter table public.quotations
  add constraint quotations_template_id_fkey
  foreign key (template_id) references public.quote_templates(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Secure-link views (real customer opens only)
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_views (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  public_token text not null,
  viewed_at timestamptz not null default now(),
  user_agent text
);

create index if not exists idx_quotation_views_quote
  on public.quotation_views(quotation_id, viewed_at desc);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT'
  ));

-- ---------------------------------------------------------------------------
-- RLS — service role bypasses; match existing quotation tables
-- ---------------------------------------------------------------------------
alter table public.quotation_approval_policies enable row level security;
alter table public.quotation_approval_requests enable row level security;
alter table public.quotation_approval_steps enable row level security;
alter table public.quotation_packages enable row level security;
alter table public.quotation_package_components enable row level security;
alter table public.quotation_views enable row level security;
