-- Seller intake requests, submissions, template versions and prepared documents.
-- Does not add the older compliance safety-baseline constraints.

create table if not exists re_seller_intake_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('open', 'sole')),
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'approved', 'retired')),
  title text not null,
  organisation_name text,
  clauses jsonb not null default '[]'::jsonb,
  exclusivity_minimum_months integer check (exclusivity_minimum_months is null or exclusivity_minimum_months > 0),
  exclusivity_continues_until_varied boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, kind, version)
);

create table if not exists re_seller_intake_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  template_id uuid not null references re_seller_intake_templates(id) on delete restrict,
  opportunity_id uuid references real_estate_acquisition_opportunities(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  responsible_agent_id uuid not null references users(id) on delete restrict,
  status text not null check (status in (
    'draft_link', 'in_progress', 'submitted', 'changes_requested',
    'review_applying', 'review_incomplete', 'accepted', 'revoked', 'expired'
  )),
  token_hash text,
  token_expires_at timestamptz,
  token_purpose text not null default 'initial' check (token_purpose in ('initial', 'resume', 'correction')),
  session_hash text,
  session_expires_at timestamptz,
  public_reference text not null,
  version integer not null default 1,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, public_reference)
);

create unique index if not exists uq_re_seller_intake_token
  on re_seller_intake_requests (token_hash)
  where token_hash is not null;

create index if not exists idx_re_seller_intake_requests_client_status
  on re_seller_intake_requests (client_id, status, updated_at desc);

create index if not exists idx_re_seller_intake_requests_opportunity
  on re_seller_intake_requests (client_id, opportunity_id);

create table if not exists re_seller_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  request_id uuid not null references re_seller_intake_requests(id) on delete cascade,
  version integer not null check (version > 0),
  answers jsonb not null default '{}'::jsonb,
  snapshot jsonb,
  accepted_groups text[] not null default '{}',
  rejected_groups jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, version)
);

create table if not exists re_seller_intake_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  request_id uuid not null references re_seller_intake_requests(id) on delete cascade,
  event_type text not null,
  actor_id uuid references users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_re_seller_intake_events_request
  on re_seller_intake_events (request_id, created_at);

create table if not exists re_seller_intake_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  request_id uuid not null unique references re_seller_intake_requests(id) on delete cascade,
  reviewer_id uuid not null references users(id) on delete restrict,
  outcome text check (outcome is null or outcome in ('accepted', 'changes_requested')),
  submission_version integer not null,
  contact_id uuid references contacts(id) on delete set null,
  opportunity_id uuid references real_estate_acquisition_opportunities(id) on delete set null,
  mandate_id uuid references real_estate_mandates(id) on delete set null,
  compliance_case_id uuid references compliance_cases(id) on delete set null,
  document_id uuid,
  applied_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists re_acquisition_parties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  opportunity_id uuid not null references real_estate_acquisition_opportunities(id) on delete cascade,
  request_id uuid references re_seller_intake_requests(id) on delete set null,
  role text not null check (role in ('registered_owner', 'representative', 'witness', 'negotiator')),
  party_kind text not null check (party_kind in ('individual', 'company')),
  contact_id uuid references contacts(id) on delete set null,
  display_name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (request_id, role)
);

create index if not exists idx_re_acquisition_parties_opportunity
  on re_acquisition_parties (client_id, opportunity_id);

create table if not exists re_seller_intake_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  request_id uuid not null references re_seller_intake_requests(id) on delete cascade,
  template_id uuid not null references re_seller_intake_templates(id) on delete restrict,
  submission_version integer not null,
  storage_key text,
  content_sha256 text not null,
  scan_status text not null default 'unscanned' check (scan_status in ('unscanned', 'pending', 'scanning', 'clean', 'infected', 'scan_failed', 'quarantined', 'blocked')),
  signature_state text not null check (signature_state in ('prepared_unsigned', 'signed_uploaded', 'evidence_reviewed')),
  byte_size integer not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_re_seller_intake_documents_request
  on re_seller_intake_documents (client_id, request_id, created_at);

create or replace function re_seller_intake_assert_tenant()
returns trigger
language plpgsql
as $$
declare
  parent_client uuid;
begin
  if tg_table_name = 're_seller_intake_requests' then
    select client_id into parent_client from re_seller_intake_templates where id = new.template_id;
    if parent_client is distinct from new.client_id then
      raise exception 'seller intake template is outside this organisation';
    end if;
    if new.opportunity_id is not null then
      select client_id into parent_client from real_estate_acquisition_opportunities where id = new.opportunity_id;
      if parent_client is distinct from new.client_id then
        raise exception 'seller intake opportunity is outside this organisation';
      end if;
    end if;
    if new.contact_id is not null then
      select client_id into parent_client from contacts where id = new.contact_id;
      if parent_client is distinct from new.client_id then
        raise exception 'seller intake contact is outside this organisation';
      end if;
    end if;
  elsif tg_table_name = 're_seller_intake_submissions' then
    select client_id into parent_client from re_seller_intake_requests where id = new.request_id;
    if parent_client is distinct from new.client_id then
      raise exception 'seller intake submission is outside this organisation';
    end if;
  elsif tg_table_name = 're_acquisition_parties' then
    select client_id into parent_client from real_estate_acquisition_opportunities where id = new.opportunity_id;
    if parent_client is distinct from new.client_id then
      raise exception 'acquisition party is outside this organisation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists re_seller_intake_requests_tenant on re_seller_intake_requests;
create trigger re_seller_intake_requests_tenant
  before insert or update on re_seller_intake_requests
  for each row execute function re_seller_intake_assert_tenant();

drop trigger if exists re_seller_intake_submissions_tenant on re_seller_intake_submissions;
create trigger re_seller_intake_submissions_tenant
  before insert or update on re_seller_intake_submissions
  for each row execute function re_seller_intake_assert_tenant();

drop trigger if exists re_acquisition_parties_tenant on re_acquisition_parties;
create trigger re_acquisition_parties_tenant
  before insert or update on re_acquisition_parties
  for each row execute function re_seller_intake_assert_tenant();

alter table re_seller_intake_templates enable row level security;
alter table re_seller_intake_requests enable row level security;
alter table re_seller_intake_submissions enable row level security;
alter table re_seller_intake_events enable row level security;
alter table re_seller_intake_reviews enable row level security;
alter table re_acquisition_parties enable row level security;
alter table re_seller_intake_documents enable row level security;

revoke all on re_seller_intake_templates from anon, authenticated;
revoke all on re_seller_intake_requests from anon, authenticated;
revoke all on re_seller_intake_submissions from anon, authenticated;
revoke all on re_seller_intake_events from anon, authenticated;
revoke all on re_seller_intake_reviews from anon, authenticated;
revoke all on re_acquisition_parties from anon, authenticated;
revoke all on re_seller_intake_documents from anon, authenticated;

comment on table re_seller_intake_requests is
  'Client seller-intake link. Access uses the application session or a hashed token. Database auth identity is not the actor.';
comment on column re_seller_intake_documents.signature_state is
  'prepared_unsigned is not completed signature evidence. evidence_reviewed is a separate reviewer decision and is not mandate approval.';
