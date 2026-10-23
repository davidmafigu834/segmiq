-- Release 4A-4C inactive foundation. Depends on
-- 20261023114812_segmiq_commercial_foundation_release1.sql.
-- No backfill, customer migration, invoice issuance, quota enforcement or
-- quota credit is performed by this migration.

create table public.platform_ai_billing_periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  price_version text not null,
  ai_sku text not null check (ai_sku in ('agentic_business','agentic_scale')),
  included_conversations integer not null check (included_conversations >= 0),
  included_ai_actions integer not null check (included_ai_actions >= 0),
  agreement_ref text not null check (length(btrim(agreement_ref)) >= 3),
  state text not null default 'open' check (state in ('open','closed','void')),
  created_at timestamptz not null default now(),
  constraint platform_ai_period_valid check (period_end > period_start),
  constraint platform_ai_period_unique unique (client_id, period_start, period_end),
  foreign key (ai_sku,price_version)
    references public.platform_price_catalog(sku,version)
);

create table public.platform_ai_conversation_windows (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  billing_period_id uuid references public.platform_ai_billing_periods(id) on delete restrict,
  channel text not null check (channel in ('whatsapp')),
  subject_key_hash text not null check (subject_key_hash ~ '^[0-9a-f]{64}$'),
  opened_at timestamptz not null,
  closes_at timestamptz not null,
  metering_mode text not null check (metering_mode in ('shadow','financial')),
  ledger_event_key text unique,
  created_at timestamptz not null default now(),
  constraint platform_ai_window_duration check (closes_at = opened_at + interval '24 hours'),
  constraint platform_ai_financial_period_required check (
    metering_mode <> 'financial' or billing_period_id is not null
  )
);

create index platform_ai_windows_subject_idx
  on public.platform_ai_conversation_windows(client_id,channel,subject_key_hash,opened_at desc);
create index platform_ai_windows_period_idx
  on public.platform_ai_conversation_windows(billing_period_id,metering_mode);

create table public.platform_ai_usage_source_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  usage_type text not null check (usage_type in ('customer_conversation','internal_ai_action')),
  source_event_key text not null,
  source_reference text,
  conversation_window_id uuid references public.platform_ai_conversation_windows(id) on delete restrict,
  billing_period_id uuid references public.platform_ai_billing_periods(id) on delete restrict,
  outcome text not null check (outcome in (
    'excluded_failed','excluded_test','excluded_unsupported','window_reused',
    'shadow_recorded','financial_recorded'
  )),
  metering_mode text not null check (metering_mode in ('shadow','financial')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (client_id,usage_type,source_event_key)
);

create index platform_ai_source_period_idx
  on public.platform_ai_usage_source_events(client_id,billing_period_id,usage_type,occurred_at);

create table public.platform_ai_topup_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  billing_period_id uuid not null references public.platform_ai_billing_periods(id) on delete restrict,
  sku text not null default 'ai_conversations_250',
  price_version text not null,
  pack_quantity integer not null check (pack_quantity between 1 and 20),
  units_per_pack integer not null check (units_per_pack = 250),
  unit_price_usd_cents integer not null check (unit_price_usd_cents >= 0),
  total_price_usd_cents integer not null check (
    total_price_usd_cents = unit_price_usd_cents * pack_quantity
  ),
  status text not null default 'requested' check (status in (
    'requested','customer_approved','awaiting_payment','payment_confirmed',
    'active','declined','cancelled','expired'
  )),
  requested_by uuid not null references public.users(id) on delete restrict,
  approved_by uuid references public.users(id) on delete restrict,
  approval_evidence_ref text,
  approved_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  activated_at timestamptz,
  idempotency_key text not null unique,
  expires_with_period boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sku,price_version)
    references public.platform_price_catalog(sku,version),
  constraint platform_ai_topup_approval_fields check (
    status in ('requested','declined','cancelled','expired') or
    (approved_by is not null and approved_at is not null and
     length(btrim(coalesce(approval_evidence_ref,''))) >= 3)
  ),
  constraint platform_ai_topup_active_payment check (
    status <> 'active' or
    (payment_id is not null and invoice_id is not null and activated_at is not null)
  )
);

create index platform_ai_topups_queue_idx
  on public.platform_ai_topup_requests(status,created_at desc);
create index platform_ai_topups_client_period_idx
  on public.platform_ai_topup_requests(client_id,billing_period_id,status);

create table public.platform_ai_topup_events (
  id bigint generated always as identity primary key,
  topup_id uuid not null references public.platform_ai_topup_requests(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  evidence_ref text,
  correlation_id text not null,
  occurred_at timestamptz not null default now(),
  unique (topup_id,correlation_id)
);

create table public.platform_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  category text not null check (category in (
    'crm_seats','agentic_addon','onboarding','ai_activation','ai_topup','discount','tax'
  )),
  sku text,
  price_version text,
  description text not null,
  contract_reference text,
  quote_revision_reference text,
  unit_price_usd_cents integer not null,
  quantity integer not null check (quantity > 0),
  discount_usd_cents integer not null default 0 check (discount_usd_cents >= 0),
  tax_usd_cents integer not null default 0 check (tax_usd_cents >= 0),
  total_usd_cents integer not null,
  currency text not null default 'USD' check (currency = 'USD'),
  period_start timestamptz,
  period_end timestamptz,
  source_idempotency_key text not null unique,
  topup_id uuid unique references public.platform_ai_topup_requests(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint platform_invoice_line_math check (
    total_usd_cents = unit_price_usd_cents * quantity - discount_usd_cents + tax_usd_cents
  ),
  constraint platform_invoice_line_nonnegative check (total_usd_cents >= 0)
);

create table public.platform_ai_usage_notification_claims (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  billing_period_id uuid not null references public.platform_ai_billing_periods(id) on delete restrict,
  usage_type text not null check (usage_type in ('customer_conversation','internal_ai_action')),
  threshold integer not null check (threshold in (80,95,100)),
  status text not null default 'pending' check (status in ('pending','delivered','failed','cancelled')),
  delivery_reference text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id,billing_period_id,usage_type,threshold)
);

create trigger platform_ai_billing_periods_immutable
  before update or delete on public.platform_ai_billing_periods
  for each row execute function public.platform_deny_history_modifications();
create trigger platform_ai_windows_immutable
  before update or delete on public.platform_ai_conversation_windows
  for each row execute function public.platform_deny_history_modifications();
create trigger platform_ai_source_events_immutable
  before update or delete on public.platform_ai_usage_source_events
  for each row execute function public.platform_deny_history_modifications();
create trigger platform_ai_topup_events_immutable
  before update or delete on public.platform_ai_topup_events
  for each row execute function public.platform_deny_history_modifications();
create trigger platform_invoice_lines_immutable
  before update or delete on public.platform_invoice_lines
  for each row execute function public.platform_deny_history_modifications();

alter table public.platform_ai_billing_periods enable row level security;
alter table public.platform_ai_conversation_windows enable row level security;
alter table public.platform_ai_usage_source_events enable row level security;
alter table public.platform_ai_topup_requests enable row level security;
alter table public.platform_ai_topup_events enable row level security;
alter table public.platform_invoice_lines enable row level security;
alter table public.platform_ai_usage_notification_claims enable row level security;

revoke all on public.platform_ai_billing_periods,
  public.platform_ai_conversation_windows,
  public.platform_ai_usage_source_events,
  public.platform_ai_topup_requests,
  public.platform_ai_topup_events,
  public.platform_invoice_lines,
  public.platform_ai_usage_notification_claims from public,anon,authenticated;
grant all on public.platform_ai_billing_periods,
  public.platform_ai_conversation_windows,
  public.platform_ai_usage_source_events,
  public.platform_ai_topup_requests,
  public.platform_ai_topup_events,
  public.platform_invoice_lines,
  public.platform_ai_usage_notification_claims to service_role;
grant usage,select on sequence public.platform_ai_topup_events_id_seq to service_role;

create or replace function public.platform_record_ai_customer_conversation(
  p_client_id uuid,
  p_source_event_key text,
  p_subject_key_hash text,
  p_channel text,
  p_occurred_at timestamptz,
  p_successful boolean,
  p_test_mode boolean,
  p_financial_requested boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.platform_ai_usage_source_events%rowtype;
  v_window public.platform_ai_conversation_windows%rowtype;
  v_period public.platform_ai_billing_periods%rowtype;
  v_account public.platform_commercial_accounts%rowtype;
  v_window_id uuid;
  v_mode text := 'shadow';
  v_outcome text;
  v_event_key text;
begin
  if length(btrim(coalesce(p_source_event_key,''))) < 3 then
    raise exception 'Stable source event key required';
  end if;
  if p_subject_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hashed subject key required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_client_id::text || ':' || p_channel || ':' || p_subject_key_hash,0)
  );

  select * into v_existing
  from public.platform_ai_usage_source_events
  where client_id=p_client_id and usage_type='customer_conversation'
    and source_event_key=p_source_event_key;
  if found then
    return pg_catalog.jsonb_build_object('outcome',v_existing.outcome,'replayed',true);
  end if;

  if not p_successful or p_test_mode or p_channel <> 'whatsapp' then
    v_outcome := case
      when p_test_mode then 'excluded_test'
      when not p_successful then 'excluded_failed'
      else 'excluded_unsupported'
    end;
    insert into public.platform_ai_usage_source_events(
      client_id,usage_type,source_event_key,source_reference,outcome,metering_mode,occurred_at
    ) values (
      p_client_id,'customer_conversation',p_source_event_key,'agent_execution',v_outcome,'shadow',p_occurred_at
    );
    return pg_catalog.jsonb_build_object('outcome',v_outcome,'replayed',false);
  end if;

  select * into v_window
  from public.platform_ai_conversation_windows
  where client_id=p_client_id and channel=p_channel
    and subject_key_hash=p_subject_key_hash
    and opened_at <= p_occurred_at and p_occurred_at < closes_at
  order by opened_at desc limit 1;
  if found then
    insert into public.platform_ai_usage_source_events(
      client_id,usage_type,source_event_key,source_reference,conversation_window_id,
      billing_period_id,outcome,metering_mode,occurred_at
    ) values (
      p_client_id,'customer_conversation',p_source_event_key,'agent_execution',v_window.id,
      v_window.billing_period_id,'window_reused',v_window.metering_mode,p_occurred_at
    );
    return pg_catalog.jsonb_build_object('outcome','window_reused','windowId',v_window.id,'replayed',false);
  end if;

  select * into v_period
  from public.platform_ai_billing_periods
  where client_id=p_client_id and state='open'
    and period_start <= p_occurred_at and p_occurred_at < period_end
  order by period_start desc limit 1;
  select * into v_account
  from public.platform_commercial_accounts where client_id=p_client_id;

  if p_financial_requested and v_period.id is not null and
     v_account.status='active' and v_account.ai_sku is not null and
     length(btrim(coalesce(v_account.agreement_ref,''))) >= 3 and
     v_account.ai_sku=v_period.ai_sku and
     v_account.price_version=v_period.price_version and
     v_account.agreement_ref=v_period.agreement_ref then
    v_mode := 'financial';
  end if;

  v_window_id := pg_catalog.gen_random_uuid();
  v_event_key := 'conversation_window:' || v_window_id::text;
  insert into public.platform_ai_conversation_windows(
    id,client_id,billing_period_id,channel,subject_key_hash,opened_at,closes_at,
    metering_mode,ledger_event_key
  ) values (
    v_window_id,p_client_id,v_period.id,p_channel,p_subject_key_hash,p_occurred_at,
    p_occurred_at + interval '24 hours',v_mode,
    case when v_mode='financial' then v_event_key else null end
  );

  if v_mode='financial' then
    insert into public.platform_ai_usage_ledger(
      client_id,usage_type,units,event_key,billing_period_start,source_reference,recorded_at
    ) values (
      p_client_id,'customer_conversation',1,v_event_key,v_period.period_start::date,
      'platform_ai_conversation_windows:' || v_window_id::text,p_occurred_at
    );
    v_outcome := 'financial_recorded';
  else
    v_outcome := 'shadow_recorded';
  end if;

  insert into public.platform_ai_usage_source_events(
    client_id,usage_type,source_event_key,source_reference,conversation_window_id,
    billing_period_id,outcome,metering_mode,occurred_at
  ) values (
    p_client_id,'customer_conversation',p_source_event_key,'agent_execution',v_window_id,
    v_period.id,v_outcome,v_mode,p_occurred_at
  );
  return pg_catalog.jsonb_build_object('outcome',v_outcome,'windowId',v_window_id,'replayed',false);
end $$;

create or replace function public.platform_record_ai_internal_action(
  p_client_id uuid,
  p_source_action_id uuid,
  p_source_event_key text,
  p_occurred_at timestamptz,
  p_financial_requested boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action record;
  v_period public.platform_ai_billing_periods%rowtype;
  v_account public.platform_commercial_accounts%rowtype;
  v_existing public.platform_ai_usage_source_events%rowtype;
  v_mode text := 'shadow';
  v_outcome text := 'excluded_unsupported';
  v_event_key text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text || ':' || p_source_event_key,0));
  select * into v_existing from public.platform_ai_usage_source_events
    where client_id=p_client_id and usage_type='internal_ai_action' and source_event_key=p_source_event_key;
  if found then return pg_catalog.jsonb_build_object('outcome',v_existing.outcome,'replayed',true); end if;

  select a.id,a.status,a.tool_name,e.test_mode
    into v_action
  from public.agent_execution_actions a
  join public.agent_executions e on e.id=a.execution_id and e.client_id=a.client_id
  where a.id=p_source_action_id and a.client_id=p_client_id;

  if v_action.id is null or v_action.status <> 'EXECUTED' or v_action.test_mode or
     v_action.tool_name <> all(array[
       'deal_create','task_create_follow_up','calendar_schedule_callback',
       'calendar_reschedule_callback','quotation_prepare_draft','quotation_send',
       'lead_update_qualification','buyer_requirements.update','viewing.schedule'
     ]) then
    insert into public.platform_ai_usage_source_events(
      client_id,usage_type,source_event_key,source_reference,outcome,metering_mode,occurred_at
    ) values (p_client_id,'internal_ai_action',p_source_event_key,
      'agent_execution_actions:' || p_source_action_id::text,
      v_outcome,
      'shadow',p_occurred_at);
    return pg_catalog.jsonb_build_object('outcome',v_outcome,'replayed',false);
  end if;

  select * into v_period from public.platform_ai_billing_periods
    where client_id=p_client_id and state='open'
      and period_start <= p_occurred_at and p_occurred_at < period_end
    order by period_start desc limit 1;
  select * into v_account from public.platform_commercial_accounts where client_id=p_client_id;
  if p_financial_requested and v_period.id is not null and
     v_account.status='active' and v_account.ai_sku is not null and
     length(btrim(coalesce(v_account.agreement_ref,''))) >= 3 and
     v_account.ai_sku=v_period.ai_sku and v_account.price_version=v_period.price_version and
     v_account.agreement_ref=v_period.agreement_ref then v_mode := 'financial'; end if;

  if v_mode='financial' then
    v_event_key := 'internal_action:' || p_source_action_id::text;
    insert into public.platform_ai_usage_ledger(
      client_id,usage_type,units,event_key,billing_period_start,source_reference,recorded_at
    ) values (p_client_id,'internal_ai_action',1,v_event_key,v_period.period_start::date,
      'agent_execution_actions:' || p_source_action_id::text,p_occurred_at);
    v_outcome := 'financial_recorded';
  else v_outcome := 'shadow_recorded'; end if;

  insert into public.platform_ai_usage_source_events(
    client_id,usage_type,source_event_key,source_reference,billing_period_id,
    outcome,metering_mode,occurred_at
  ) values (p_client_id,'internal_ai_action',p_source_event_key,
    'agent_execution_actions:' || p_source_action_id::text,v_period.id,v_outcome,v_mode,p_occurred_at);
  return pg_catalog.jsonb_build_object('outcome',v_outcome,'replayed',false);
end $$;

create or replace function public.platform_request_ai_topup(
  p_client_id uuid,
  p_actor_user_id uuid,
  p_billing_period_id uuid,
  p_pack_quantity integer,
  p_idempotency_key text,
  p_consent_version text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := pg_catalog.gen_random_uuid();
  v_existing uuid;
  v_price integer;
begin
  if p_pack_quantity < 1 or p_pack_quantity > 20 then raise exception 'Pack quantity must be between 1 and 20'; end if;
  if length(btrim(coalesce(p_consent_version,''))) < 3 then raise exception 'Payable terms consent required'; end if;
  if not exists(
    select 1 from public.users where id=p_actor_user_id and client_id=p_client_id
      and role='CLIENT_MANAGER' and is_active=true
  ) then raise exception 'Authorised company manager required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text || ':' || p_idempotency_key,0));
  select id into v_existing from public.platform_ai_topup_requests where idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if not exists(
    select 1 from public.platform_ai_billing_periods
    where id=p_billing_period_id and client_id=p_client_id and state='open' and now() < period_end
  ) then raise exception 'Active contracted billing period required'; end if;
  select price_usd_cents into strict v_price from public.platform_price_catalog
    where sku='ai_conversations_250' and version='2026-10-22' and is_available=true;
  insert into public.platform_ai_topup_requests(
    id,client_id,billing_period_id,price_version,pack_quantity,units_per_pack,
    unit_price_usd_cents,total_price_usd_cents,status,requested_by,approved_by,
    approval_evidence_ref,approved_at,idempotency_key
  ) values (v_id,p_client_id,p_billing_period_id,'2026-10-22',p_pack_quantity,250,
    v_price,v_price*p_pack_quantity,'customer_approved',p_actor_user_id,p_actor_user_id,
    'in_app_consent:' || p_consent_version,now(),p_idempotency_key);
  insert into public.platform_ai_topup_events(
    topup_id,client_id,actor_user_id,action,from_status,to_status,evidence_ref,correlation_id
  ) values (v_id,p_client_id,p_actor_user_id,'customer_approved',null,'customer_approved',
    'in_app_consent:' || p_consent_version,p_idempotency_key);
  return v_id;
end $$;

revoke execute on function public.platform_record_ai_customer_conversation(uuid,text,text,text,timestamptz,boolean,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.platform_record_ai_internal_action(uuid,uuid,text,timestamptz,boolean) from public,anon,authenticated;
revoke execute on function public.platform_request_ai_topup(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.platform_record_ai_customer_conversation(uuid,text,text,text,timestamptz,boolean,boolean,boolean) to service_role;
grant execute on function public.platform_record_ai_internal_action(uuid,uuid,text,timestamptz,boolean) to service_role;
grant execute on function public.platform_request_ai_topup(uuid,uuid,uuid,integer,text,text) to service_role;
