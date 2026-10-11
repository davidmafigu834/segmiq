-- Phase 2: selected Zoho Books customers and items can be stored in SegmiQ.
-- Invoice rows here are a read-only snapshot of Books status and unpaid balance.
-- Nothing in this migration writes to Zoho Books.

alter table public.zoho_books_record_links
  add column if not exists segmiq_id uuid,
  add column if not exists books_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists zoho_books_record_links_local_idx
  on public.zoho_books_record_links (client_id, resource_type, segmiq_id)
  where segmiq_id is not null;

comment on table public.zoho_books_record_links is
  'Maps one Zoho record to one SegmiQ contact or product for one company and one Books organisation. Matching is by Zoho id, not by name.';
comment on column public.zoho_books_record_links.segmiq_id is
  'contacts.id for customers, products.id for items.';
comment on column public.zoho_books_record_links.books_snapshot is
  'Books figures that must not be written into SegmiQ inventory or accounting, including stock field names and tax labels.';

comment on column public.zoho_books_connections.sync_enabled is
  'Stays false. Sync now is a manual request. A future schedule must not run while this is false.';

create table if not exists public.zoho_books_invoice_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  connection_id uuid not null references public.zoho_books_connections(id) on delete cascade,
  zoho_organization_id text not null,
  external_invoice_id text not null,
  external_customer_id text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  invoice_number text,
  status text,
  currency_code text,
  total numeric,
  balance numeric,
  credits_applied numeric,
  invoice_date date,
  due_date date,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, zoho_organization_id, external_invoice_id)
);

create index if not exists zoho_books_invoice_snapshots_customer_idx
  on public.zoho_books_invoice_snapshots (client_id, zoho_organization_id, external_customer_id);

comment on table public.zoho_books_invoice_snapshots is
  'Read-only copy of Zoho Books invoice status, total, and unpaid balance. Not a SegmiQ invoice, payment, cash receipt, or won deal.';
comment on column public.zoho_books_invoice_snapshots.balance is
  'Books field balance: the unpaid amount. Partial payments, credits, and void status are already reflected by Books.';

create table if not exists public.zoho_books_sync_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  connection_id uuid not null references public.zoho_books_connections(id) on delete cascade,
  zoho_organization_id text not null,
  kind text not null check (kind in ('import', 'refresh')),
  status text not null check (status in ('running', 'needs_decision', 'completed', 'paused', 'failed')),
  actor_user_id uuid references public.users(id) on delete set null,
  checkpoint jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists zoho_books_sync_runs_one_active_idx
  on public.zoho_books_sync_runs (client_id)
  where status in ('running', 'needs_decision', 'paused');

create index if not exists zoho_books_sync_runs_client_idx
  on public.zoho_books_sync_runs (client_id, created_at desc);

comment on table public.zoho_books_sync_runs is
  'Manual import and refresh progress for one company. The checkpoint advances only after the local write succeeds.';

alter table public.zoho_books_invoice_snapshots enable row level security;
alter table public.zoho_books_sync_runs enable row level security;

revoke all on public.zoho_books_invoice_snapshots from public, anon, authenticated;
revoke all on public.zoho_books_sync_runs from public, anon, authenticated;

grant all on public.zoho_books_invoice_snapshots to service_role;
grant all on public.zoho_books_sync_runs to service_role;
