-- Seller-intake access history, template organisation name, document immutability
-- and an atomic review claim.
-- Depends on 20261105140000_real_estate_seller_intake.sql.
-- Does not add the compliance safety-baseline constraints.

alter table re_seller_intake_templates
  add column if not exists organisation_name text;

comment on column re_seller_intake_templates.organisation_name is
  'Display name supplied by the organisation for this template version. Not a platform default.';

create table if not exists re_seller_intake_revoked_tokens (
  token_hash text primary key,
  client_id uuid not null references clients(id) on delete cascade,
  request_id uuid not null references re_seller_intake_requests(id) on delete cascade,
  revoked_at timestamptz not null default now()
);

create index if not exists idx_re_seller_intake_revoked_tokens_request
  on re_seller_intake_revoked_tokens (request_id, revoked_at desc);

create table if not exists re_seller_intake_revoked_sessions (
  session_hash text primary key,
  client_id uuid not null references clients(id) on delete cascade,
  request_id uuid not null references re_seller_intake_requests(id) on delete cascade,
  revoked_at timestamptz not null default now()
);

alter table re_seller_intake_revoked_tokens enable row level security;
alter table re_seller_intake_revoked_sessions enable row level security;
revoke all on re_seller_intake_revoked_tokens from anon, authenticated;
revoke all on re_seller_intake_revoked_sessions from anon, authenticated;

create or replace function re_seller_intake_claim_review(p_request uuid, p_client uuid, p_version integer)
returns setof re_seller_intake_requests
language sql
as $$
  update re_seller_intake_requests
  set status = 'review_applying',
      version = version + 1,
      updated_at = now()
  where id = p_request
    and client_id = p_client
    and version = p_version
    and status in ('submitted', 'review_incomplete')
  returning *;
$$;

revoke all on function re_seller_intake_claim_review(uuid, uuid, integer) from public, anon, authenticated;

create or replace function re_seller_intake_document_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.storage_key is distinct from new.storage_key
     or old.content_sha256 is distinct from new.content_sha256
     or old.byte_size is distinct from new.byte_size
     or old.template_id is distinct from new.template_id
     or old.submission_version is distinct from new.submission_version then
    raise exception 'seller document bytes cannot be replaced';
  end if;
  if old.scan_status in ('clean', 'infected', 'quarantined')
     and new.scan_status is distinct from old.scan_status then
    raise exception 'a finished seller document scan cannot be overwritten';
  end if;
  return new;
end;
$$;

drop trigger if exists re_seller_intake_documents_immutable on re_seller_intake_documents;
create trigger re_seller_intake_documents_immutable
  before update on re_seller_intake_documents
  for each row execute function re_seller_intake_document_immutable();
