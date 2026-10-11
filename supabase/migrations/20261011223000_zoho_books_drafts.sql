-- Phase 3: SegmiQ records of Zoho Books drafts created from a quotation.
-- Books remains the accounting document. These rows store the external id,
-- number, status, and total. They are not a second ledger, payment, or won deal.
-- NextAuth sessions are not Supabase auth users, so these tables have no
-- auth.uid() policies. The Data API roles cannot read them. The server uses
-- the service role and filters every query by the company id.

create table if not exists public.zoho_books_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  connection_id uuid not null references public.zoho_books_connections(id) on delete cascade,
  zoho_organization_id text not null,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  kind text not null check (kind in ('estimate', 'invoice')),
  external_id text,
  external_number text,
  status text,
  currency_code text,
  books_total numeric,
  segmiq_total numeric,
  total_difference numeric,
  reference_number text not null,
  external_customer_id text,
  unexpected_status boolean not null default false,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, zoho_organization_id, kind, quotation_id),
  unique (client_id, zoho_organization_id, reference_number)
);

create index if not exists zoho_books_documents_quote_idx
  on public.zoho_books_documents (client_id, quotation_id);

comment on table public.zoho_books_documents is
  'Link from a SegmiQ quotation to a Zoho Books estimate or invoice. The Books total is a snapshot. It is not copied into SegmiQ revenue, cash, or the subscription invoice table.';

create table if not exists public.zoho_books_write_operations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  connection_id uuid not null references public.zoho_books_connections(id) on delete cascade,
  zoho_organization_id text not null,
  operation_key text not null,
  kind text not null check (kind in ('estimate', 'invoice', 'customer')),
  quotation_id uuid references public.quotations(id) on delete set null,
  status text not null check (status in ('reserved', 'uncertain', 'succeeded', 'failed', 'needs_reconciliation')),
  actor_user_id uuid references public.users(id) on delete set null,
  external_id text,
  reference_number text,
  safe_error text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, operation_key)
);

create index if not exists zoho_books_write_operations_status_idx
  on public.zoho_books_write_operations (client_id, status);

comment on table public.zoho_books_write_operations is
  'One in-flight Zoho Books write per company and operation. A timeout stays uncertain and is not posted again until a search by reference_number or email shows what Books has.';

alter table public.zoho_books_documents enable row level security;
alter table public.zoho_books_write_operations enable row level security;

revoke all on public.zoho_books_documents from public, anon, authenticated;
revoke all on public.zoho_books_write_operations from public, anon, authenticated;

grant all on public.zoho_books_documents to service_role;
grant all on public.zoho_books_write_operations to service_role;
