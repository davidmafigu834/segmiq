-- Release 3: platform-owned sales offers and agreement foundation.
-- Additive only. This file is pending controlled application; do not blanket db-push.

create table public.platform_sales_prospects (
  id uuid primary key default gen_random_uuid(), organisation_name text not null check(length(btrim(organisation_name)) >= 2),
  legal_name text, trading_name text, industry text, contact_name text not null, contact_position text,
  email text, phone text, address text, source text, notes text,
  status text not null default 'new' check(status in ('new','qualified','quoted','agreement','converted','lost')),
  converted_client_id uuid references public.clients(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict, updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index platform_sales_prospects_converted_client_unique on public.platform_sales_prospects(converted_client_id) where converted_client_id is not null;
create index platform_sales_prospects_status_idx on public.platform_sales_prospects(status,updated_at desc);

create sequence public.platform_sales_quote_number_seq;
create table public.platform_sales_quotes (
  id uuid primary key default gen_random_uuid(), prospect_id uuid not null references public.platform_sales_prospects(id) on delete restrict,
  quote_number text not null unique, current_revision integer not null default 1 check(current_revision > 0), accepted_revision integer,
  status text not null default 'draft' check(status in ('draft','link_created','sent','viewed','accepted','declined','changes_requested','expired','superseded','converted')),
  valid_until date not null, created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  converted_at timestamptz
);
create index platform_sales_quotes_prospect_idx on public.platform_sales_quotes(prospect_id,created_at desc);

create table public.platform_sales_quote_revisions (
  quote_id uuid not null references public.platform_sales_quotes(id) on delete restrict, revision integer not null check(revision > 0),
  status text not null default 'draft' check(status in ('draft','issued','superseded')),
  currency text not null check(currency='USD'), catalogue_version text not null,
  pricing_snapshot jsonb not null, commercial_notes text,
  recurring_total_usd_cents integer not null check(recurring_total_usd_cents >= 0),
  one_time_total_usd_cents integer not null check(one_time_total_usd_cents >= 0),
  tax_usd_cents integer not null check(tax_usd_cents >= 0), initial_due_usd_cents integer not null check(initial_due_usd_cents >= 0),
  pdf_object_key text, pdf_sha256 text, content_sha256 text not null,
  rendered_at timestamptz, issued_at timestamptz, created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(), primary key(quote_id,revision)
);

create table public.platform_sales_quote_events (
  id bigint generated always as identity primary key, quote_id uuid not null references public.platform_sales_quotes(id) on delete restrict,
  revision integer, actor_type text not null check(actor_type in ('platform_admin','prospect_recipient','system')),
  actor_user_id uuid references public.users(id) on delete set null, action text not null, correlation_id text not null,
  metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), unique(quote_id,correlation_id)
);
create index platform_sales_quote_events_quote_idx on public.platform_sales_quote_events(quote_id,occurred_at desc);

create table public.platform_sales_quote_links (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null, revision integer not null,
  token_hash text not null unique check(length(token_hash)=64), purpose text not null check(purpose='quote_review'),
  expires_at timestamptz not null, redeemed_at timestamptz, revoked_at timestamptz,
  request_count integer not null default 0 check(request_count >= 0), last_accessed_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict, created_at timestamptz not null default now(),
  foreign key(quote_id,revision) references public.platform_sales_quote_revisions(quote_id,revision) on delete restrict
);
create index platform_sales_quote_links_quote_idx on public.platform_sales_quote_links(quote_id,revision,expires_at);

create table public.platform_agreement_templates (
  id uuid primary key default gen_random_uuid(), version text not null unique, locale text not null, jurisdiction text not null,
  status text not null default 'draft' check(status in ('draft','approved','retired')), source_object_key text,
  source_sha256 text not null, approved_by uuid references public.users(id) on delete set null, approved_at timestamptz,
  effective_from date, effective_to date, created_by uuid not null references public.users(id) on delete restrict, created_at timestamptz not null default now(),
  constraint agreement_template_approval_complete check(status <> 'approved' or (approved_by is not null and approved_at is not null and source_object_key is not null))
);
create table public.platform_customer_agreements (
  id uuid primary key default gen_random_uuid(), prospect_id uuid references public.platform_sales_prospects(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict, quote_id uuid, quote_revision integer,
  template_id uuid not null references public.platform_agreement_templates(id) on delete restrict,
  signing_flow text not null check(signing_flow in ('direct_signup','accepted_sales_quote')),
  status text not null default 'draft' check(status in ('draft','issued','viewed','signed_by_customer','awaiting_countersign','executed','declined','expired','void')),
  pricing_snapshot jsonb not null, purchased_seats integer not null check(purchased_seats > 0), billing_terms jsonb not null,
  pdf_object_key text, pdf_sha256 text, expires_at timestamptz, created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(quote_id,quote_revision) references public.platform_sales_quote_revisions(quote_id,revision) on delete restrict,
  constraint agreement_party_present check(prospect_id is not null or client_id is not null)
);
create table public.platform_agreement_signers (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.platform_customer_agreements(id) on delete restrict,
  signer_role text not null, email text, phone text, claimed_name text, claimed_title text, claimed_company text,
  identity_state text not null default 'pending' check(identity_state in ('pending','verified','failed','revoked')),
  method text, invited_at timestamptz, verified_at timestamptz, signed_at timestamptz, evidence_digest text,
  created_at timestamptz not null default now()
);
create table public.platform_agreement_signatures (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.platform_customer_agreements(id) on delete restrict,
  signer_id uuid not null references public.platform_agreement_signers(id) on delete restrict,
  document_sha256 text not null, consent_text_version text not null, signed_at timestamptz not null,
  verified_method text not null, evidence_digest text not null, correlation_id text not null unique, final_pdf_sha256 text,
  created_at timestamptz not null default now(), unique(agreement_id,signer_id)
);
create table public.platform_agreement_events (
  id bigint generated always as identity primary key, agreement_id uuid not null references public.platform_customer_agreements(id) on delete restrict,
  actor_type text not null, actor_user_id uuid references public.users(id) on delete set null,
  action text not null, before_status text, after_status text, document_sha256 text, correlation_id text not null,
  metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), unique(agreement_id,correlation_id)
);
create table public.platform_agreement_access_tokens (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.platform_customer_agreements(id) on delete restrict,
  signer_id uuid references public.platform_agreement_signers(id) on delete restrict, purpose text not null,
  token_hash text not null unique check(length(token_hash)=64), expires_at timestamptz not null,
  redeemed_at timestamptz, revoked_at timestamptz, attempt_count integer not null default 0, created_at timestamptz not null default now()
);

create or replace function public.platform_sales_prevent_issued_revision_change() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if old.status='issued' and tg_op='UPDATE' and new.status='superseded' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new; end if;
  if old.status in ('issued','superseded') then raise exception 'Issued sales quote revisions are immutable'; end if;
  return new;
end $$;
create trigger platform_sales_revision_immutable before update or delete on public.platform_sales_quote_revisions for each row execute function public.platform_sales_prevent_issued_revision_change();
create trigger platform_sales_events_immutable before update or delete on public.platform_sales_quote_events for each row execute function public.platform_deny_history_modifications();
create trigger platform_agreement_signatures_immutable before update or delete on public.platform_agreement_signatures for each row execute function public.platform_deny_history_modifications();
create trigger platform_agreement_events_immutable before update or delete on public.platform_agreement_events for each row execute function public.platform_deny_history_modifications();
create or replace function public.platform_prevent_approved_template_change() returns trigger language plpgsql set search_path=pg_catalog as $$
begin if old.status in ('approved','retired') then raise exception 'Approved agreement template versions are immutable'; end if; return new; end $$;
create trigger platform_agreement_template_immutable before update or delete on public.platform_agreement_templates for each row execute function public.platform_prevent_approved_template_change();

create or replace function public.platform_create_sales_quote(p_prospect_id uuid,p_actor_user_id uuid,p_snapshot jsonb,p_valid_until date,p_notes text,p_content_sha256 text,p_correlation_id text)
returns uuid language plpgsql set search_path=public,pg_catalog as $$
declare v_quote uuid := gen_random_uuid(); v_number text;
begin
  if not exists(select 1 from public.users where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true) then raise exception 'SUPER_ADMIN required'; end if;
  if not exists(select 1 from public.platform_sales_prospects where id=p_prospect_id and converted_client_id is null) then raise exception 'Prospect not found or already converted'; end if;
  perform public.platform_validate_price_snapshot(jsonb_build_object(
    'catalogueVersion',p_snapshot->>'catalogueVersion','currency',p_snapshot->>'currency','crmSku',p_snapshot#>>'{lines,0,sku}',
    'aiSku',(select value->>'sku' from jsonb_array_elements(p_snapshot->'lines') where value->>'sku' like 'agentic_%' limit 1),
    'purchasedSeats',(p_snapshot#>>'{lines,0,quantity}')::integer,'seatUnitPriceUsdCents',(p_snapshot#>>'{lines,0,unitPriceUsdCents}')::integer,
    'crmMonthlyUsdCents',(p_snapshot#>>'{lines,0,subtotalUsdCents}')::integer,
    'aiMonthlyUsdCents',coalesce((select (value->>'subtotalUsdCents')::integer from jsonb_array_elements(p_snapshot->'lines') where value->>'sku' like 'agentic_%' limit 1),0),
    'recurringMonthlyUsdCents',(p_snapshot->>'recurringSubtotalUsdCents')::integer,
    'billingCycle','monthly','recurringCycleUsdCents',(p_snapshot->>'recurringSubtotalUsdCents')::integer));
  v_number := 'PSQ-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.platform_sales_quote_number_seq')::text,6,'0');
  insert into public.platform_sales_quotes(id,prospect_id,quote_number,valid_until,created_by,updated_by) values(v_quote,p_prospect_id,v_number,p_valid_until,p_actor_user_id,p_actor_user_id);
  insert into public.platform_sales_quote_revisions(quote_id,revision,currency,catalogue_version,pricing_snapshot,commercial_notes,recurring_total_usd_cents,one_time_total_usd_cents,tax_usd_cents,initial_due_usd_cents,content_sha256,created_by)
  values(v_quote,1,'USD',p_snapshot->>'catalogueVersion',p_snapshot,p_notes,(p_snapshot->>'recurringTotalUsdCents')::integer,(p_snapshot->>'oneTimeTotalUsdCents')::integer,(p_snapshot->>'taxUsdCents')::integer,(p_snapshot->>'initialDueUsdCents')::integer,p_content_sha256,p_actor_user_id);
  insert into public.platform_sales_quote_events(quote_id,revision,actor_type,actor_user_id,action,correlation_id) values(v_quote,1,'platform_admin',p_actor_user_id,'DRAFT_CREATED',p_correlation_id);
  update public.platform_sales_prospects set status='quoted',updated_by=p_actor_user_id,updated_at=now() where id=p_prospect_id;
  return v_quote;
end $$;

create or replace function public.platform_issue_sales_quote(p_quote_id uuid,p_actor_user_id uuid,p_pdf_object_key text,p_pdf_sha256 text,p_token_hash text,p_token_expires_at timestamptz,p_correlation_id text)
returns jsonb language plpgsql set search_path=public,pg_catalog as $$
declare v_quote public.platform_sales_quotes%rowtype; v_link uuid := gen_random_uuid();
begin
  if not exists(select 1 from public.users where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true) then raise exception 'SUPER_ADMIN required'; end if;
  select * into v_quote from public.platform_sales_quotes where id=p_quote_id for update;
  if not found or v_quote.status <> 'draft' then raise exception 'Quote is not an issuable draft'; end if;
  if v_quote.valid_until < current_date then raise exception 'Quote is expired'; end if;
  update public.platform_sales_quote_revisions set status='issued',pdf_object_key=p_pdf_object_key,pdf_sha256=p_pdf_sha256,rendered_at=now(),issued_at=now()
    where quote_id=p_quote_id and revision=v_quote.current_revision and status='draft';
  update public.platform_sales_quotes set status='link_created',updated_by=p_actor_user_id,updated_at=now() where id=p_quote_id;
  insert into public.platform_sales_quote_links(id,quote_id,revision,token_hash,purpose,expires_at,created_by) values(v_link,p_quote_id,v_quote.current_revision,p_token_hash,'quote_review',p_token_expires_at,p_actor_user_id);
  insert into public.platform_sales_quote_events(quote_id,revision,actor_type,actor_user_id,action,correlation_id,metadata)
    values(p_quote_id,v_quote.current_revision,'platform_admin',p_actor_user_id,'LINK_CREATED',p_correlation_id,jsonb_build_object('sent',false));
  return jsonb_build_object('link_id',v_link,'revision',v_quote.current_revision);
end $$;

create or replace function public.platform_revise_sales_quote(p_quote_id uuid,p_actor_user_id uuid,p_snapshot jsonb,p_valid_until date,p_notes text,p_content_sha256 text,p_correlation_id text)
returns integer language plpgsql set search_path=public,pg_catalog as $$
declare v_quote public.platform_sales_quotes%rowtype; v_revision integer;
begin
  if not exists(select 1 from public.users where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true) then raise exception 'SUPER_ADMIN required'; end if;
  select * into v_quote from public.platform_sales_quotes where id=p_quote_id for update;
  if not found or v_quote.status in ('accepted','converted') then raise exception 'Quote cannot be revised'; end if;
  v_revision := v_quote.current_revision+1;
  update public.platform_sales_quote_revisions set status='superseded' where quote_id=p_quote_id and revision=v_quote.current_revision and status='issued';
  update public.platform_sales_quote_links set revoked_at=now() where quote_id=p_quote_id and revoked_at is null and redeemed_at is null;
  insert into public.platform_sales_quote_revisions(quote_id,revision,currency,catalogue_version,pricing_snapshot,commercial_notes,recurring_total_usd_cents,one_time_total_usd_cents,tax_usd_cents,initial_due_usd_cents,content_sha256,created_by)
  values(p_quote_id,v_revision,'USD',p_snapshot->>'catalogueVersion',p_snapshot,p_notes,(p_snapshot->>'recurringTotalUsdCents')::integer,(p_snapshot->>'oneTimeTotalUsdCents')::integer,(p_snapshot->>'taxUsdCents')::integer,(p_snapshot->>'initialDueUsdCents')::integer,p_content_sha256,p_actor_user_id);
  update public.platform_sales_quotes set current_revision=v_revision,status='draft',valid_until=p_valid_until,updated_by=p_actor_user_id,updated_at=now() where id=p_quote_id;
  insert into public.platform_sales_quote_events(quote_id,revision,actor_type,actor_user_id,action,correlation_id) values(p_quote_id,v_revision,'platform_admin',p_actor_user_id,'REVISION_CREATED',p_correlation_id);
  return v_revision;
end $$;

create or replace function public.platform_get_sales_quote_by_token(p_token_hash text,p_correlation_id text)
returns jsonb language plpgsql set search_path=public,pg_catalog as $$
declare v_link public.platform_sales_quote_links%rowtype; v_quote public.platform_sales_quotes%rowtype; v_payload jsonb;
begin
  select * into v_link from public.platform_sales_quote_links where token_hash=p_token_hash for update;
  if not found or v_link.revoked_at is not null or v_link.redeemed_at is not null or v_link.expires_at <= now() or v_link.request_count >= 100 then return null; end if;
  select * into v_quote from public.platform_sales_quotes where id=v_link.quote_id for update;
  if v_quote.current_revision <> v_link.revision or v_quote.status not in ('link_created','sent','viewed') or v_quote.valid_until < current_date then return null; end if;
  update public.platform_sales_quote_links set request_count=request_count+1,last_accessed_at=now() where id=v_link.id;
  if v_quote.status in ('link_created','sent') then
    update public.platform_sales_quotes set status='viewed',updated_at=now() where id=v_quote.id;
    insert into public.platform_sales_quote_events(quote_id,revision,actor_type,action,correlation_id) values(v_quote.id,v_link.revision,'prospect_recipient','VIEWED',p_correlation_id) on conflict do nothing;
  end if;
  select jsonb_build_object('quote_id',v_quote.id,'quote_number',v_quote.quote_number,'status','viewed','valid_until',v_quote.valid_until,
    'revision',r.revision,'snapshot',r.pricing_snapshot,'notes',r.commercial_notes,'pdf_available',r.pdf_object_key is not null,
    'prospect',jsonb_build_object('organisation_name',p.organisation_name,'legal_name',p.legal_name,'contact_name',p.contact_name)) into v_payload
    from public.platform_sales_quote_revisions r join public.platform_sales_prospects p on p.id=v_quote.prospect_id
    where r.quote_id=v_quote.id and r.revision=v_link.revision;
  return v_payload;
end $$;

create or replace function public.platform_respond_sales_quote(p_token_hash text,p_action text,p_name text,p_title text,p_authority_confirmed boolean,p_correlation_id text)
returns text language plpgsql set search_path=public,pg_catalog as $$
declare v_link public.platform_sales_quote_links%rowtype; v_quote public.platform_sales_quotes%rowtype; v_status text;
begin
  if p_action not in ('accept','decline','request_changes') then raise exception 'Invalid response'; end if;
  select * into v_link from public.platform_sales_quote_links where token_hash=p_token_hash for update;
  if not found or v_link.revoked_at is not null or v_link.redeemed_at is not null or v_link.expires_at <= now() then raise exception 'Link is not active'; end if;
  select * into v_quote from public.platform_sales_quotes where id=v_link.quote_id for update;
  if v_quote.current_revision<>v_link.revision or v_quote.status not in ('link_created','sent','viewed') or v_quote.valid_until<current_date then raise exception 'Quote cannot be responded to'; end if;
  if p_action='accept' and (not p_authority_confirmed or length(btrim(coalesce(p_name,'')))<2 or length(btrim(coalesce(p_title,'')))<2) then raise exception 'Named authority confirmation is required'; end if;
  v_status := case p_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'changes_requested' end;
  update public.platform_sales_quotes set status=v_status,accepted_revision=case when p_action='accept' then v_link.revision else accepted_revision end,updated_at=now() where id=v_quote.id;
  update public.platform_sales_quote_links set redeemed_at=now() where id=v_link.id;
  insert into public.platform_sales_quote_events(quote_id,revision,actor_type,action,correlation_id,metadata)
    values(v_quote.id,v_link.revision,'prospect_recipient',upper(p_action),p_correlation_id,jsonb_build_object('name',p_name,'title',p_title,'authority_confirmed',p_authority_confirmed));
  return v_status;
end $$;

alter table public.platform_sales_prospects enable row level security; alter table public.platform_sales_quotes enable row level security;
alter table public.platform_sales_quote_revisions enable row level security; alter table public.platform_sales_quote_events enable row level security;
alter table public.platform_sales_quote_links enable row level security; alter table public.platform_agreement_templates enable row level security;
alter table public.platform_customer_agreements enable row level security; alter table public.platform_agreement_signers enable row level security;
alter table public.platform_agreement_signatures enable row level security; alter table public.platform_agreement_events enable row level security;
alter table public.platform_agreement_access_tokens enable row level security;

revoke all on public.platform_sales_prospects,public.platform_sales_quotes,public.platform_sales_quote_revisions,public.platform_sales_quote_events,public.platform_sales_quote_links,
  public.platform_agreement_templates,public.platform_customer_agreements,public.platform_agreement_signers,public.platform_agreement_signatures,public.platform_agreement_events,public.platform_agreement_access_tokens from anon,authenticated;
grant all on public.platform_sales_prospects,public.platform_sales_quotes,public.platform_sales_quote_revisions,public.platform_sales_quote_events,public.platform_sales_quote_links,
  public.platform_agreement_templates,public.platform_customer_agreements,public.platform_agreement_signers,public.platform_agreement_signatures,public.platform_agreement_events,public.platform_agreement_access_tokens to service_role;
grant usage,select on sequence public.platform_sales_quote_number_seq to service_role;

revoke execute on function public.platform_sales_prevent_issued_revision_change() from public,anon,authenticated;
revoke execute on function public.platform_prevent_approved_template_change() from public,anon,authenticated;
revoke execute on function public.platform_create_sales_quote(uuid,uuid,jsonb,date,text,text,text) from public,anon,authenticated;
revoke execute on function public.platform_issue_sales_quote(uuid,uuid,text,text,text,timestamptz,text) from public,anon,authenticated;
revoke execute on function public.platform_revise_sales_quote(uuid,uuid,jsonb,date,text,text,text) from public,anon,authenticated;
revoke execute on function public.platform_get_sales_quote_by_token(text,text) from public,anon,authenticated;
revoke execute on function public.platform_respond_sales_quote(text,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.platform_create_sales_quote(uuid,uuid,jsonb,date,text,text,text) to service_role;
grant execute on function public.platform_issue_sales_quote(uuid,uuid,text,text,text,timestamptz,text) to service_role;
grant execute on function public.platform_revise_sales_quote(uuid,uuid,jsonb,date,text,text,text) to service_role;
grant execute on function public.platform_get_sales_quote_by_token(text,text) to service_role;
grant execute on function public.platform_respond_sales_quote(text,text,text,text,boolean,text) to service_role;
