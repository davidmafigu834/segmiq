-- 051_quotations.sql
-- Quotation creator: product/price catalog + lead-linked quotations with line items.
-- Replaces the manual "build a quote in Excel" workflow. Additive only.

-- ---------------------------------------------------------------------------
-- product_catalog — reusable priced items a rep can drop into a quote.
-- Managed by the client manager (mirrors pricing_packages access).
-- ---------------------------------------------------------------------------
create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  unit_price numeric not null default 0,
  category text,                       -- e.g. inverter | battery | panel | accessory | labour | other
  currency text not null default 'USD',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_catalog_client on public.product_catalog(client_id);
create index if not exists idx_product_catalog_active on public.product_catalog(client_id, is_active);

-- ---------------------------------------------------------------------------
-- quotation_settings — per-client header/footer + numbering for the PDF.
-- One row per client.
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_settings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  company_address text,
  company_email text,
  company_website text,
  company_phone text,
  default_terms text,
  footer_note text,
  quote_prefix text not null default 'Q',
  next_number integer not null default 1,
  default_tax_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- quotations — a generated quote tied to a lead.
-- ---------------------------------------------------------------------------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  quote_number text,                   -- assigned on first send (e.g. Q0007)
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  customer_name text,
  customer_phone text,
  customer_email text,
  subtotal numeric not null default 0,
  tax_rate numeric not null default 0,
  tax_amount numeric not null default 0,
  other_amount numeric not null default 0,
  total numeric not null default 0,
  currency text not null default 'USD',
  valid_until date,
  notes text,
  terms text,
  prepared_by_id uuid references public.users(id) on delete set null,
  prepared_by_name text,
  pdf_url text,
  pdf_key text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotations_lead on public.quotations(lead_id);
create index if not exists idx_quotations_client on public.quotations(client_id);
create index if not exists idx_quotations_status on public.quotations(client_id, status);

-- ---------------------------------------------------------------------------
-- quotation_line_items — ordered rows on a quote.
-- catalog_item_id is null for free-form / one-off rows.
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_line_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  catalog_item_id uuid references public.product_catalog(id) on delete set null,
  item_name text not null,
  description text,
  unit_price numeric not null default 0,
  quantity numeric not null default 1,
  amount numeric not null default 0,
  group_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotation_line_items_quote on public.quotation_line_items(quotation_id);

-- ---------------------------------------------------------------------------
-- RLS — match the rest of the schema (enable; service role bypasses).
-- ---------------------------------------------------------------------------
alter table public.product_catalog enable row level security;
alter table public.quotation_settings enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_line_items enable row level security;
