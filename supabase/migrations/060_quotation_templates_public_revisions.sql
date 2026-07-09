-- 060_quotation_templates_public_revisions.sql
-- Quote templates, public customer links, view tracking, and revision chain.

-- ---------------------------------------------------------------------------
-- quote_templates — reusable full-quote starting points (manager-managed).
-- ---------------------------------------------------------------------------
create table if not exists public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  tax_rate numeric not null default 0,
  other_amount numeric not null default 0,
  notes text,
  terms text,
  valid_for_days integer not null default 30,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_templates_client on public.quote_templates(client_id, is_active);

create table if not exists public.quote_template_line_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quote_templates(id) on delete cascade,
  catalog_item_id uuid references public.product_catalog(id) on delete set null,
  item_name text not null,
  description text,
  unit_price numeric not null default 0,
  quantity numeric not null default 1,
  group_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_template_items on public.quote_template_line_items(template_id);

-- ---------------------------------------------------------------------------
-- quotations — public link, customer view/respond, revision chain.
-- ---------------------------------------------------------------------------
alter table public.quotations
  add column if not exists public_token text unique,
  add column if not exists viewed_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists parent_quotation_id uuid references public.quotations(id) on delete set null,
  add column if not exists revision_number integer not null default 1,
  add column if not exists superseded_by_id uuid references public.quotations(id) on delete set null;

create index if not exists idx_quotations_public_token on public.quotations(public_token);
create index if not exists idx_quotations_parent on public.quotations(parent_quotation_id);

alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations
  add constraint quotations_status_check
  check (status in ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'));

alter table public.quote_templates enable row level security;
alter table public.quote_template_line_items enable row level security;
