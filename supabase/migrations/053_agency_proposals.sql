-- 053_agency_proposals.sql
-- Agency sales proposals: Segmiq's own B2B sales documents (you -> prospect
-- companies). Distinct from tenant-level quotations (051): agency-scoped,
-- richer (narrative sections + priced line items), delivered via a hosted
-- public link + PDF + email, with accept/reject tracking. On acceptance the
-- prospect is auto-provisioned into a pending client + draft subscription.
-- Additive only.

-- ---------------------------------------------------------------------------
-- agency_proposal_settings — single agency-level row: Segmiq's own header/
-- footer + numbering for the proposal PDF.
-- ---------------------------------------------------------------------------
create table if not exists public.agency_proposal_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  company_address text,
  company_email text,
  company_phone text,
  company_website text,
  logo_url text,
  brand_color text not null default '#0F7A4F',
  default_terms text,
  footer_note text,
  proposal_prefix text not null default 'P',
  next_number integer not null default 1,
  default_tax_rate numeric not null default 0,
  default_validity_days integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed exactly one settings row.
insert into public.agency_proposal_settings (company_name)
select 'Segmiq'
where not exists (select 1 from public.agency_proposal_settings);

-- ---------------------------------------------------------------------------
-- agency_proposals — a rich sales proposal to a prospect company.
-- submission_id is optional (supports ad-hoc prospects with no marketing form).
-- client_id is set after acceptance for traceability into the provisioned tenant.
-- ---------------------------------------------------------------------------
create table if not exists public.agency_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_number text,                          -- assigned on first send (e.g. P0007)
  submission_id uuid references public.marketing_submissions(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  company_name text,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  title text not null default 'Proposal',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  public_token text unique,
  proposed_mode text not null default 'team' check (proposed_mode in ('team', 'solo')),
  proposed_plan text not null default 'starter' check (proposed_plan in ('starter', 'professional', 'business')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  currency text not null default 'USD',
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax_rate numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  valid_until date,
  notes text,
  terms text,
  prepared_by_id uuid references public.users(id) on delete set null,
  prepared_by_name text,
  pdf_url text,
  pdf_key text,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agency_proposals_status on public.agency_proposals(status, created_at desc);
create index if not exists idx_agency_proposals_submission on public.agency_proposals(submission_id);
create index if not exists idx_agency_proposals_token on public.agency_proposals(public_token);

-- ---------------------------------------------------------------------------
-- agency_proposal_sections — ordered narrative blocks (the "rich" part).
-- ---------------------------------------------------------------------------
create table if not exists public.agency_proposal_sections (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.agency_proposals(id) on delete cascade,
  kind text not null default 'custom'
    check (kind in ('cover', 'scope', 'approach', 'timeline', 'terms', 'investment', 'custom')),
  heading text,
  body text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_agency_proposal_sections_proposal on public.agency_proposal_sections(proposal_id);

-- ---------------------------------------------------------------------------
-- agency_proposal_line_items — priced rows (the "investment" section).
-- ---------------------------------------------------------------------------
create table if not exists public.agency_proposal_line_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.agency_proposals(id) on delete cascade,
  item_name text not null,
  description text,
  unit_price numeric not null default 0,
  quantity numeric not null default 1,
  amount numeric not null default 0,
  group_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_agency_proposal_line_items_proposal on public.agency_proposal_line_items(proposal_id);

-- ---------------------------------------------------------------------------
-- agency_proposal_templates — reusable starting points (sections + line items).
-- ---------------------------------------------------------------------------
create table if not exists public.agency_proposal_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sections jsonb not null default '[]',
  default_line_items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Allow a 'draft' subscription status — a placeholder created when a proposal
-- is accepted, before the owner pays/onboards. Does not gate portal access
-- (middleware only blocks 'suspended').
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('draft', 'active', 'past_due', 'suspended', 'cancelled'));

-- ---------------------------------------------------------------------------
-- RLS — parity with the rest of the schema (service role bypasses).
-- ---------------------------------------------------------------------------
alter table public.agency_proposal_settings enable row level security;
alter table public.agency_proposals enable row level security;
alter table public.agency_proposal_sections enable row level security;
alter table public.agency_proposal_line_items enable row level security;
alter table public.agency_proposal_templates enable row level security;
