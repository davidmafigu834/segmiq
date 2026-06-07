-- 038_manual_billing.sql
-- Manual-payment billing foundation: subscriptions, invoices, payments,
-- payment proofs, receipts, agency billing settings, and year-scoped document counters.
-- Additive only — no existing table/column is altered or dropped.
--
-- Payment processing is manual (bank transfer / mobile money / cash): the agency
-- issues invoices and records/confirms payments by hand. No Stripe, no cards.
-- This migration builds data + the concurrency-safe invoice-number allocator only.
-- Portal UI, access gate, cron, and WhatsApp arrive in later prompts.

-- ── Subscriptions ──────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  product text not null default 'crm' check (product in ('crm', 'cloud')),
  plan text not null check (plan in ('starter', 'growth', 'scale')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null default 'active' check (status in ('active', 'past_due', 'suspended', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_days int not null default 7,
  started_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_client_id_idx on public.subscriptions(client_id);

-- ── Invoices ───────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text not null unique,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft', 'sent', 'overdue', 'paid', 'void')),
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_subscription_id_idx on public.invoices(subscription_id);
create index if not exists invoices_status_due_at_idx on public.invoices(status, due_at);
create index if not exists invoices_client_status_idx on public.invoices(client_id, status);

-- ── Payments ───────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  method text not null check (method in ('bank_transfer', 'mobile_money', 'cash', 'other')),
  method_detail text,
  reference text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  recorded_via text not null check (recorded_via in ('client_upload', 'agency_manual')),
  recorded_by uuid references public.users(id) on delete set null,
  confirmed_by uuid references public.users(id) on delete set null,
  confirmed_at timestamptz,
  rejected_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
create index if not exists payments_client_id_idx on public.payments(client_id);
create index if not exists payments_status_idx on public.payments(status);

-- ── Payment proofs ─────────────────────────────────────────────────────────
create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  file_url text not null,
  file_name text,
  file_type text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_proofs_payment_id_idx on public.payment_proofs(payment_id);

-- ── Billing settings (single agency-level row) ──────────────────────────────
create table if not exists public.billing_settings (
  id uuid primary key default gen_random_uuid(),
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  swift text,
  mobile_money_number text,
  mobile_money_name text,
  payment_instructions text,
  updated_at timestamptz not null default now()
);

-- ── Receipts (one per confirmed payment) ─────────────────────────────────────
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  receipt_number text not null unique,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  issued_at timestamptz not null default now(),
  pdf_url text,
  created_at timestamptz not null default now()
);

create index if not exists receipts_payment_id_idx on public.receipts(payment_id);
create index if not exists receipts_client_id_idx on public.receipts(client_id);

-- ── Year-scoped document counters (invoice + receipt sequences) ─────────────
create table if not exists public.billing_document_counters (
  doc_type text not null check (doc_type in ('invoice', 'receipt')),
  year int not null,
  last_number int not null default 0,
  primary key (doc_type, year)
);

-- ── RLS (parity with prior migrations; service role bypasses) ───────────────
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.billing_settings enable row level security;
alter table public.receipts enable row level security;
alter table public.billing_document_counters enable row level security;

-- ── Invoice allocator ───────────────────────────────────────────────────────
-- Allocates the next SEG-YYYY-NNNN number and inserts the invoice atomically in
-- one transaction. The year counter row is locked with SELECT ... FOR UPDATE so
-- concurrent issuance can never produce a duplicate number (no MAX()+1 race).
-- Idempotent per period: if a non-void invoice already covers the subscription's
-- current period, it is returned instead of creating a second one.
create or replace function public.create_crm_invoice(p_subscription_id uuid)
returns table (invoice_id uuid, invoice_number text, already_existed boolean)
language plpgsql
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_year int;
  v_next int;
  v_number text;
  v_existing_id uuid;
  v_existing_number text;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  -- Idempotency: an existing non-void invoice for this exact period wins.
  select i.id, i.invoice_number
    into v_existing_id, v_existing_number
  from public.invoices i
  where i.subscription_id = p_subscription_id
    and i.period_start is not distinct from v_sub.current_period_start
    and i.period_end is not distinct from v_sub.current_period_end
    and i.status <> 'void'
  limit 1;

  if found then
    invoice_id := v_existing_id;
    invoice_number := v_existing_number;
    already_existed := true;
    return next;
    return;
  end if;

  v_year := extract(year from now())::int;

  -- Ensure the counter row exists, then lock it for the increment.
  insert into public.billing_document_counters (doc_type, year, last_number)
    values ('invoice', v_year, 0)
    on conflict (doc_type, year) do nothing;

  select last_number into v_next
    from public.billing_document_counters
    where doc_type = 'invoice' and year = v_year
    for update;

  v_next := v_next + 1;

  update public.billing_document_counters
    set last_number = v_next
    where doc_type = 'invoice' and year = v_year;

  v_number := 'SEG-' || v_year::text || '-' || lpad(v_next::text, 4, '0');

  insert into public.invoices (
    subscription_id, client_id, invoice_number, amount, currency, status,
    period_start, period_end, issued_at, due_at
  ) values (
    p_subscription_id, v_sub.client_id, v_number, v_sub.amount, v_sub.currency, 'sent',
    v_sub.current_period_start, v_sub.current_period_end, now(), now()
  )
  returning id into v_existing_id;

  invoice_id := v_existing_id;
  invoice_number := v_number;
  already_existed := false;
  return next;
end;
$$;

-- ── Receipt allocator ───────────────────────────────────────────────────────
-- Allocates SEG-R-YYYY-NNNN for a confirmed payment. Idempotent per payment_id.
create or replace function public.create_crm_receipt(p_payment_id uuid)
returns table (receipt_id uuid, receipt_number text, already_existed boolean)
language plpgsql
as $$
declare
  v_pay public.payments%rowtype;
  v_year int;
  v_next int;
  v_number text;
  v_existing_id uuid;
  v_existing_number text;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found then
    raise exception 'payment % not found', p_payment_id;
  end if;
  if v_pay.status <> 'confirmed' then
    raise exception 'payment % is not confirmed', p_payment_id;
  end if;

  select r.id, r.receipt_number
    into v_existing_id, v_existing_number
  from public.receipts r
  where r.payment_id = p_payment_id
  limit 1;

  if found then
    receipt_id := v_existing_id;
    receipt_number := v_existing_number;
    already_existed := true;
    return next;
    return;
  end if;

  v_year := extract(year from now())::int;

  insert into public.billing_document_counters (doc_type, year, last_number)
    values ('receipt', v_year, 0)
    on conflict (doc_type, year) do nothing;

  select last_number into v_next
    from public.billing_document_counters
    where doc_type = 'receipt' and year = v_year
    for update;

  v_next := v_next + 1;

  update public.billing_document_counters
    set last_number = v_next
    where doc_type = 'receipt' and year = v_year;

  v_number := 'SEG-R-' || v_year::text || '-' || lpad(v_next::text, 4, '0');

  insert into public.receipts (
    payment_id, client_id, receipt_number, amount, currency, issued_at
  ) values (
    p_payment_id, v_pay.client_id, v_number, v_pay.amount, v_pay.currency, coalesce(v_pay.paid_at, now())
  )
  returning id into v_existing_id;

  receipt_id := v_existing_id;
  receipt_number := v_number;
  already_existed := false;
  return next;
end;
$$;

-- ── Seed exactly one billing_settings row ───────────────────────────────────
insert into public.billing_settings (updated_at)
select now()
where not exists (select 1 from public.billing_settings);

-- ── Backfill: one active CRM subscription per existing client ───────────────
-- Plan mapped from clients.plan (starter/professional/business). Amount from the
-- CRM plan constant (starter 99, growth 199, scale 349). No invoices are created.
-- Re-runnable: skips clients that already have a CRM subscription.
insert into public.subscriptions (
  client_id, product, plan, amount, status,
  current_period_start, current_period_end, started_at, grace_days
)
select
  c.id,
  'crm',
  case c.plan
    when 'professional' then 'growth'
    when 'business' then 'scale'
    else 'starter'
  end,
  case c.plan
    when 'professional' then 199
    when 'business' then 349
    else 99
  end,
  'active',
  now(),
  now() + interval '1 month',
  now(),
  7
from public.clients c
where not exists (
  select 1 from public.subscriptions s
  where s.client_id = c.id and s.product = 'crm'
);
