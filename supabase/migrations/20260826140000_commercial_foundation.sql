-- Commercial foundation: Products, Inventory, Packages.
-- Additive only. Legacy product_catalog / quotation_packages remain until Stage L.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Feature flags (per tenant)
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists commercial_flags jsonb not null default '{
    "products.v2.enabled": true,
    "inventory.enabled": true,
    "packages.v2.enabled": true,
    "quotation.productPickerV2": true,
    "inventory.externalSync": false
  }'::jsonb;

-- ---------------------------------------------------------------------------
-- Units of measure
-- ---------------------------------------------------------------------------
create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  code text not null,
  name text not null,
  allow_fractional boolean not null default false,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_uom_client_code
  on public.units_of_measure (client_id, lower(code))
  where client_id is not null;
create unique index if not exists idx_uom_builtin_code
  on public.units_of_measure (lower(code))
  where client_id is null;

insert into public.units_of_measure (client_id, code, name, allow_fractional, is_builtin)
select null, x.code, x.name, x.frac, true
from (values
  ('Each', 'Each', false),
  ('Pair', 'Pair', false),
  ('Set', 'Set', false),
  ('Box', 'Box', false),
  ('Pack', 'Pack', false),
  ('Roll', 'Roll', true),
  ('Metre', 'Metre', true),
  ('m²', 'Square metre', true),
  ('Kilogram', 'Kilogram', true),
  ('Litre', 'Litre', true),
  ('Hour', 'Hour', true),
  ('Day', 'Day', false),
  ('Month', 'Month', false),
  ('Service', 'Service', false),
  ('Unit', 'Unit', false),
  ('Lot', 'Lot', false),
  ('Project', 'Project', false)
) as x(code, name, frac)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  parent_id uuid references public.product_categories(id) on delete set null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_categories_client
  on public.product_categories (client_id, parent_id, sort_order);

-- ---------------------------------------------------------------------------
-- Products (PRODUCT | SERVICE)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  item_type text not null default 'PRODUCT'
    check (item_type in ('PRODUCT', 'SERVICE')),
  name text not null,
  sku text,
  barcode text,
  internal_code text,
  brand text,
  manufacturer text,
  category_id uuid references public.product_categories(id) on delete set null,
  description text,
  quotation_description text,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  unit text not null default 'Each',
  selling_price numeric not null default 0,
  currency text not null default 'USD',
  tax_rate numeric,
  cost_price numeric,
  cost_currency text,
  min_selling_price numeric,
  track_inventory boolean not null default false,
  allow_fractional_qty boolean not null default false,
  warranty text,
  can_be_quoted boolean not null default true,
  requires_technical_confirmation boolean not null default false,
  price_editable_on_quote boolean not null default true,
  discount_allowed boolean not null default true,
  primary_image_url text,
  primary_image_key text,
  documents jsonb not null default '[]'::jsonb,
  extra_images jsonb not null default '[]'::jsonb,
  specs jsonb not null default '[]'::jsonb,
  preferred_supplier_name text,
  supplier_sku text,
  lead_time_days integer,
  legacy_catalog_item_id uuid,
  external_system text,
  external_id text,
  external_sku text,
  last_synced_at timestamptz,
  sync_status text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_products_client_sku
  on public.products (client_id, lower(btrim(sku)))
  where sku is not null and length(btrim(sku)) > 0;
create index if not exists idx_products_client_barcode
  on public.products (client_id, barcode)
  where barcode is not null and length(btrim(barcode)) > 0;
create index if not exists idx_products_client_status_name
  on public.products (client_id, status, name);
create index if not exists idx_products_client_category
  on public.products (client_id, category_id);
create index if not exists idx_products_client_brand
  on public.products (client_id, brand)
  where brand is not null;
create index if not exists idx_products_legacy
  on public.products (client_id, legacy_catalog_item_id)
  where legacy_catalog_item_id is not null;
create index if not exists idx_products_external
  on public.products (client_id, external_system, external_id)
  where external_id is not null;
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);
create index if not exists idx_products_sku_trgm
  on public.products using gin (sku gin_trgm_ops)
  where sku is not null;

-- ---------------------------------------------------------------------------
-- Variants + attribute definitions
-- ---------------------------------------------------------------------------
create table if not exists public.product_attribute_defs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  name text not null,
  attr_type text not null default 'TEXT'
    check (attr_type in ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT')),
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_attr_defs
  on public.product_attribute_defs (client_id, product_id, sort_order);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  attributes jsonb not null default '{}'::jsonb,
  selling_price_override numeric,
  cost_price_override numeric,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  track_inventory boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_product_variants_client_sku
  on public.product_variants (client_id, lower(btrim(sku)))
  where sku is not null and length(btrim(sku)) > 0;
create index if not exists idx_product_variants_product
  on public.product_variants (product_id, status);
create index if not exists idx_product_variants_barcode
  on public.product_variants (client_id, barcode)
  where barcode is not null and length(btrim(barcode)) > 0;

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_settings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  provider text not null default 'SEGMIQ'
    check (provider in ('SEGMIQ', 'EXTERNAL')),
  allow_negative_stock boolean not null default false,
  default_location_id uuid,
  stale_after_minutes integer not null default 60,
  agent_disclosure text not null default 'GENERAL'
    check (agent_disclosure in ('EXACT', 'GENERAL', 'HIDDEN')),
  warn_insufficient_stock boolean not null default true,
  block_insufficient_stock boolean not null default false,
  low_stock_notifications boolean not null default true,
  external_provider_name text,
  last_sync_at timestamptz,
  last_sync_error text,
  last_sync_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  code text,
  location_type text not null default 'WAREHOUSE'
    check (location_type in ('WAREHOUSE', 'STORE', 'BRANCH', 'OTHER')),
  address text,
  city text,
  country text,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  is_default boolean not null default false,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_locations_client
  on public.inventory_locations (client_id, status);
create unique index if not exists idx_inventory_locations_default
  on public.inventory_locations (client_id)
  where is_default = true and status = 'ACTIVE';

alter table public.inventory_settings
  drop constraint if exists inventory_settings_default_location_id_fkey;
alter table public.inventory_settings
  add constraint inventory_settings_default_location_id_fkey
  foreign key (default_location_id) references public.inventory_locations(id) on delete set null;

create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  on_hand numeric not null default 0,
  reserved numeric not null default 0,
  reorder_level numeric,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_inventory_balances_stockable
  on public.inventory_balances (client_id, location_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_inventory_balances_product
  on public.inventory_balances (client_id, product_id, variant_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  movement_type text not null
    check (movement_type in (
      'STOCK_RECEIVED',
      'OPENING_BALANCE',
      'STOCK_ADJUSTMENT',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'RESERVATION',
      'RESERVATION_RELEASED',
      'STOCK_ISSUED',
      'RETURN',
      'DAMAGED',
      'IMPORT'
    )),
  quantity numeric not null,
  balance_before numeric,
  balance_after numeric,
  reason text,
  reference_type text,
  reference_id uuid,
  transfer_id uuid,
  performed_by uuid references public.users(id) on delete set null,
  source text not null default 'USER',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_client_time
  on public.inventory_movements (client_id, occurred_at desc);
create index if not exists idx_inventory_movements_type
  on public.inventory_movements (client_id, movement_type, occurred_at desc);
create index if not exists idx_inventory_movements_product
  on public.inventory_movements (client_id, product_id, occurred_at desc);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  from_location_id uuid not null references public.inventory_locations(id),
  to_location_id uuid not null references public.inventory_locations(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity numeric not null,
  status text not null default 'COMPLETED'
    check (status in ('COMPLETED', 'CANCELLED')),
  performed_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_transfers_client
  on public.inventory_transfers (client_id, created_at desc);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity numeric not null,
  source_type text not null,
  source_id uuid,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'RELEASED', 'CONSUMED')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create index if not exists idx_inventory_reservations_active
  on public.inventory_reservations (client_id, status, product_id)
  where status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Packages
-- ---------------------------------------------------------------------------
create table if not exists public.commercial_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  code text,
  category_id uuid references public.product_categories(id) on delete set null,
  description text,
  customer_facing_description text,
  internal_notes text,
  image_url text,
  image_key text,
  pricing_mode text not null default 'SUM_OF_ITEMS'
    check (pricing_mode in ('SUM_OF_ITEMS', 'FIXED_PRICE')),
  fixed_price numeric,
  currency text not null default 'USD',
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')),
  can_be_quoted boolean not null default true,
  presentation_mode text not null default 'SHOW_COMPONENTS'
    check (presentation_mode in ('SHOW_COMPONENTS', 'SHOW_PACKAGE_SUMMARY')),
  tags jsonb not null default '[]'::jsonb,
  flexibility text not null default 'flexible'
    check (flexibility in ('locked', 'flexible', 'quantity_adjustable')),
  discount_percent numeric not null default 0,
  legacy_quotation_package_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_packages_client
  on public.commercial_packages (client_id, status, name);
create unique index if not exists idx_commercial_packages_legacy
  on public.commercial_packages (client_id, legacy_quotation_package_id)
  where legacy_quotation_package_id is not null;

create table if not exists public.commercial_package_sections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid not null references public.commercial_packages(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_commercial_package_sections
  on public.commercial_package_sections (package_id, sort_order);

create table if not exists public.commercial_package_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid not null references public.commercial_packages(id) on delete cascade,
  section_id uuid references public.commercial_package_sections(id) on delete set null,
  item_type text not null default 'PRODUCT'
    check (item_type in ('PRODUCT', 'SERVICE')),
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity numeric not null default 1,
  optional boolean not null default false,
  sort_order integer not null default 0,
  price_override numeric,
  variant_mode text not null default 'FIXED_VARIANT'
    check (variant_mode in ('FIXED_VARIANT', 'CUSTOMER_SELECTION', 'QUOTE_TIME_SELECTION')),
  snapshot_name text,
  snapshot_sku text,
  snapshot_unit text,
  snapshot_unit_price numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_commercial_package_items
  on public.commercial_package_items (package_id, sort_order);

-- ---------------------------------------------------------------------------
-- Activity + import jobs
-- ---------------------------------------------------------------------------
create table if not exists public.product_activity_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  package_id uuid references public.commercial_packages(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  actor_name text,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_activity_product
  on public.product_activity_events (product_id, created_at desc);
create index if not exists idx_product_activity_package
  on public.product_activity_events (package_id, created_at desc);

create table if not exists public.commercial_import_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  status text not null default 'UPLOADED'
    check (status in ('UPLOADED', 'MAPPING', 'VALIDATING', 'IMPORTING', 'COMPLETE', 'FAILED')),
  file_name text,
  file_type text,
  column_map jsonb not null default '{}'::jsonb,
  duplicate_mode text not null default 'SKIP'
    check (duplicate_mode in ('CREATE', 'UPDATE', 'SKIP')),
  total_rows integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  warning_count integer not null default 0,
  cursor_row integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  error_report text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_import_jobs_client
  on public.commercial_import_jobs (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Quote snapshot additives (nullable — historical rows stay valid)
-- ---------------------------------------------------------------------------
alter table public.quotation_line_items
  add column if not exists source_type text,
  add column if not exists product_id uuid,
  add column if not exists variant_id uuid,
  add column if not exists package_expansion jsonb,
  add column if not exists warranty_snapshot text;

do $$ begin
  alter table public.quotation_line_items
    add constraint quotation_line_items_source_type_check
    check (source_type is null or source_type in ('PRODUCT', 'SERVICE', 'PACKAGE', 'CUSTOM'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT',
    'INVENTORY_ALERT', 'COMMERCIAL_IMPORT'
  ));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.units_of_measure enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_attribute_defs enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_settings enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.commercial_packages enable row level security;
alter table public.commercial_package_sections enable row level security;
alter table public.commercial_package_items enable row level security;
alter table public.product_activity_events enable row level security;
alter table public.commercial_import_jobs enable row level security;

comment on table public.products is
  'Canonical things a company sells. Not stock, not a quotation line, not a package.';
comment on table public.inventory_balances is
  'Quantity at a location for a stockable product or variant. Available = on_hand - reserved.';
comment on table public.commercial_packages is
  'Reusable commercial combinations of products and services. Not warehouse stock.';

-- ---------------------------------------------------------------------------
-- Data copy from legacy catalogue (non-destructive)
-- Duplicate SKUs: first row keeps SKU, later rows get a unique suffix.
-- ---------------------------------------------------------------------------
insert into public.products (
  client_id, item_type, name, sku, category_id, description, quotation_description,
  status, unit, selling_price, currency, tax_rate, cost_price, min_selling_price,
  track_inventory, warranty, can_be_quoted, requires_technical_confirmation,
  primary_image_url, legacy_catalog_item_id, created_at, updated_at
)
select
  c.client_id,
  case when c.item_kind = 'service' then 'SERVICE' else 'PRODUCT' end,
  c.name,
  case
    when c.sku is null or length(btrim(c.sku)) = 0 then null
    when row_number() over (
      partition by c.client_id, lower(btrim(c.sku))
      order by c.created_at, c.id
    ) = 1 then btrim(c.sku)
    else left(btrim(c.sku) || '-dup-' || substr(c.id::text, 1, 8), 80)
  end,
  null,
  c.description,
  c.description,
  case when c.is_active then 'ACTIVE' else 'INACTIVE' end,
  coalesce(nullif(c.unit, ''), 'Each'),
  coalesce(c.unit_price, 0),
  coalesce(c.currency, 'USD'),
  c.tax_rate,
  c.cost_price,
  c.min_selling_price,
  false,
  c.warranty,
  true,
  coalesce(c.requires_approval, false),
  c.image_url,
  c.id,
  c.created_at,
  c.updated_at
from public.product_catalog c
where not exists (
  select 1 from public.products p
  where p.client_id = c.client_id and p.legacy_catalog_item_id = c.id
);

insert into public.commercial_packages (
  client_id, name, description, customer_facing_description, pricing_mode,
  fixed_price, currency, status, can_be_quoted, flexibility, discount_percent,
  legacy_quotation_package_id, created_at, updated_at
)
select
  q.client_id,
  q.name,
  q.description,
  q.description,
  case
    when q.pricing_model = 'fixed' then 'FIXED_PRICE'
    else 'SUM_OF_ITEMS'
  end,
  q.fixed_price,
  coalesce(q.currency, 'USD'),
  case when q.is_active then 'ACTIVE' else 'INACTIVE' end,
  true,
  q.flexibility,
  coalesce(q.discount_percent, 0),
  q.id,
  q.created_at,
  q.updated_at
from public.quotation_packages q
where not exists (
  select 1 from public.commercial_packages p
  where p.client_id = q.client_id and p.legacy_quotation_package_id = q.id
);

insert into public.commercial_package_items (
  client_id, package_id, item_type, product_id, quantity, optional, sort_order,
  snapshot_name, snapshot_sku, snapshot_unit, snapshot_unit_price
)
select
  pkg.client_id,
  pkg.id,
  coalesce((select case when pr.item_type = 'SERVICE' then 'SERVICE' else 'PRODUCT' end
            from public.products pr where pr.legacy_catalog_item_id = qc.catalog_item_id limit 1), 'PRODUCT'),
  (select pr.id from public.products pr where pr.legacy_catalog_item_id = qc.catalog_item_id limit 1),
  coalesce(qc.quantity, 1),
  coalesce(qc.is_optional, false),
  coalesce(qc.sort_order, 0),
  qc.item_name,
  qc.sku,
  qc.unit,
  qc.unit_price
from public.quotation_package_components qc
join public.commercial_packages pkg
  on pkg.legacy_quotation_package_id = qc.package_id
where not exists (
  select 1 from public.commercial_package_items i
  where i.package_id = pkg.id and i.sort_order = coalesce(qc.sort_order, 0) and i.snapshot_name = qc.item_name
);

