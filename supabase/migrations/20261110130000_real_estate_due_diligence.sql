-- Sale-mandate due diligence. The application uses the service role after its own session check.
-- anon and authenticated have no grants. Database auth identity is not the actor.
-- Do not treat a Pass from this schema as a Deeds Office result.

create table if not exists re_dd_mandates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  agent_id uuid not null references users(id) on delete restrict,
  reference text not null,
  status text not null check (status in ('draft', 'processing', 'report_ready', 'cleared', 'rejected')),
  report_status text check (report_status is null or report_status in ('pass', 'conditional_pass', 'fail')),
  risk_score integer check (risk_score is null or (risk_score >= 0 and risk_score <= 100)),
  identity_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, reference)
);

create index if not exists idx_re_dd_mandates_client_updated
  on re_dd_mandates (client_id, updated_at desc);

create table if not exists re_dd_sellers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mandate_id uuid not null unique references re_dd_mandates(id) on delete cascade,
  full_name text not null,
  id_number text not null,
  phone text not null,
  email text not null default '',
  marital_status text not null check (marital_status in ('single', 'married', 'divorced', 'widowed', 'other')),
  seller_kind text not null check (seller_kind in ('individual', 'company')),
  company_name text not null default '',
  acting_capacity text not null check (acting_capacity in ('owner', 'representative')),
  representative_name text not null default ''
);

create table if not exists re_dd_properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mandate_id uuid not null unique references re_dd_mandates(id) on delete cascade,
  address text not null,
  stand_number text not null,
  suburb text not null,
  city text not null,
  property_type text not null check (property_type in ('residential', 'commercial', 'land', 'sectional', 'other')),
  tenure_type text not null check (tenure_type in ('title_deed', 'council_cession', 'developer_cession')),
  asking_price_usd numeric check (asking_price_usd is null or asking_price_usd >= 0),
  local_authority text not null default ''
);

create table if not exists re_dd_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mandate_id uuid not null references re_dd_mandates(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  content_type text not null,
  byte_size integer not null check (byte_size > 0),
  storage_key text not null,
  sha256 text not null,
  status text not null check (status in ('uploaded', 'extracting', 'extracted', 'failed')),
  extracted_data jsonb,
  extraction_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_re_dd_documents_mandate
  on re_dd_documents (mandate_id, created_at);

create table if not exists re_dd_checks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mandate_id uuid not null references re_dd_mandates(id) on delete cascade,
  code text not null,
  label text not null,
  status text not null check (status in ('pass', 'warning', 'fail', 'not_applicable')),
  critical boolean not null default false,
  weight integer not null default 0,
  detail text not null,
  evidence jsonb not null default '{}'::jsonb,
  source text not null check (source in ('rules', 'human')),
  note text,
  updated_at timestamptz not null default now(),
  unique (mandate_id, code)
);

create table if not exists re_dd_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mandate_id uuid not null references re_dd_mandates(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('pass', 'conditional_pass', 'fail')),
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  summary text not null,
  reasons jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  comparison jsonb not null default '[]'::jsonb,
  missing_documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (mandate_id, version)
);

create table if not exists re_dd_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mandate_id uuid not null references re_dd_mandates(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  check_code text,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists re_dd_audit (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mandate_id uuid not null references re_dd_mandates(id) on delete cascade,
  event_type text not null,
  actor_id uuid references users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_re_dd_audit_mandate
  on re_dd_audit (mandate_id, created_at);

create or replace function re_dd_assert_tenant()
returns trigger
language plpgsql
as $$
declare
  parent_client uuid;
  agent_client uuid;
begin
  if tg_table_name = 're_dd_mandates' then
    select client_id into agent_client from users where id = new.agent_id;
    if agent_client is distinct from new.client_id then
      raise exception 'due diligence agent is outside this organisation';
    end if;
  else
    select client_id into parent_client from re_dd_mandates where id = new.mandate_id;
    if parent_client is distinct from new.client_id then
      raise exception 'due diligence row is outside this organisation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists re_dd_mandates_tenant on re_dd_mandates;
create trigger re_dd_mandates_tenant
  before insert or update on re_dd_mandates
  for each row execute function re_dd_assert_tenant();

drop trigger if exists re_dd_sellers_tenant on re_dd_sellers;
create trigger re_dd_sellers_tenant
  before insert or update on re_dd_sellers
  for each row execute function re_dd_assert_tenant();

drop trigger if exists re_dd_properties_tenant on re_dd_properties;
create trigger re_dd_properties_tenant
  before insert or update on re_dd_properties
  for each row execute function re_dd_assert_tenant();

drop trigger if exists re_dd_documents_tenant on re_dd_documents;
create trigger re_dd_documents_tenant
  before insert or update on re_dd_documents
  for each row execute function re_dd_assert_tenant();

drop trigger if exists re_dd_checks_tenant on re_dd_checks;
create trigger re_dd_checks_tenant
  before insert or update on re_dd_checks
  for each row execute function re_dd_assert_tenant();

drop trigger if exists re_dd_reports_tenant on re_dd_reports;
create trigger re_dd_reports_tenant
  before insert or update on re_dd_reports
  for each row execute function re_dd_assert_tenant();

drop trigger if exists re_dd_reviews_tenant on re_dd_reviews;
create trigger re_dd_reviews_tenant
  before insert or update on re_dd_reviews
  for each row execute function re_dd_assert_tenant();

drop trigger if exists re_dd_audit_tenant on re_dd_audit;
create trigger re_dd_audit_tenant
  before insert or update on re_dd_audit
  for each row execute function re_dd_assert_tenant();

alter table re_dd_mandates enable row level security;
alter table re_dd_sellers enable row level security;
alter table re_dd_properties enable row level security;
alter table re_dd_documents enable row level security;
alter table re_dd_checks enable row level security;
alter table re_dd_reports enable row level security;
alter table re_dd_reviews enable row level security;
alter table re_dd_audit enable row level security;

revoke all on re_dd_mandates from anon, authenticated;
revoke all on re_dd_sellers from anon, authenticated;
revoke all on re_dd_properties from anon, authenticated;
revoke all on re_dd_documents from anon, authenticated;
revoke all on re_dd_checks from anon, authenticated;
revoke all on re_dd_reports from anon, authenticated;
revoke all on re_dd_reviews from anon, authenticated;
revoke all on re_dd_audit from anon, authenticated;

comment on table re_dd_mandates is
  'Agent sale-mandate file for Zimbabwe due diligence. Access is the application session. A report status is not a Deeds Registry result.';
create or replace function re_dd_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'due diligence % rows cannot be changed', tg_table_name;
end;
$$;

drop trigger if exists re_dd_audit_immutable on re_dd_audit;
create trigger re_dd_audit_immutable
  before update or delete on re_dd_audit
  for each row execute function re_dd_reject_mutation();

drop trigger if exists re_dd_reviews_immutable on re_dd_reviews;
create trigger re_dd_reviews_immutable
  before update or delete on re_dd_reviews
  for each row execute function re_dd_reject_mutation();

comment on table re_dd_audit is
  'Append-only record of checks, uploads, overrides, and clearance decisions for one mandate.';
