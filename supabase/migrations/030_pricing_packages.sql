-- 030_pricing_packages.sql
-- Pricing packages and client documents for one-tap send panel

create table if not exists pricing_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  description text,
  price_from numeric,
  price_to numeric,
  price_label text,
  currency text default 'USD',
  includes text[],
  is_featured boolean default false,
  is_active boolean default true,
  valid_until date,
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists pricing_packages_client_id_idx
  on pricing_packages(client_id, display_order);

alter table pricing_packages enable row level security;

create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  description text,
  file_url text not null,
  storage_key text,
  file_type text,
  file_size_bytes integer,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists client_documents_client_id_idx
  on client_documents(client_id);

alter table client_documents enable row level security;
