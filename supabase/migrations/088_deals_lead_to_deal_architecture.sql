-- 088_deals_lead_to_deal_architecture.sql
-- Lead (acquisition/qualification) vs Deal (commercial opportunity) domain split.
-- Migrates legacy commercial pipeline lead statuses into deals; preserves lead history.

-- ---------------------------------------------------------------------------
-- 1. Deals table
-- ---------------------------------------------------------------------------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  originating_lead_id uuid not null references public.leads(id) on delete restrict,
  owner_id uuid references public.users(id) on delete set null,

  name text not null,
  service_summary text,

  stage text not null
    check (stage in (
      'QUALIFIED', 'SCOPING', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON', 'LOST'
    ))
    default 'QUALIFIED',

  value_status text not null
    check (value_status in ('KNOWN', 'RANGE', 'PENDING_ESTIMATE'))
    default 'PENDING_ESTIMATE',
  value_basis text
    check (value_basis is null or value_basis in (
      'CUSTOMER_BUDGET', 'SALES_ESTIMATE', 'LATEST_QUOTE', 'WON_VALUE'
    )),

  estimated_value numeric,
  estimated_value_min numeric,
  estimated_value_max numeric,
  customer_budget numeric,
  sales_estimate numeric,

  expected_decision_at date,
  location text,
  buying_timeframe text,
  decision_maker_status text
    check (decision_maker_status is null or decision_maker_status in (
      'YES', 'NO', 'UNKNOWN'
    )),
  decision_maker_name text,

  next_action_at timestamptz,
  next_action_label text,

  won_value numeric,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,

  last_meaningful_activity_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deals is
  'Commercial opportunities created from qualified leads. Lead rows preserve acquisition history.';

create index if not exists idx_deals_client on public.deals(client_id);
create index if not exists idx_deals_owner_stage on public.deals(client_id, owner_id, stage);
create index if not exists idx_deals_contact on public.deals(contact_id);
create index if not exists idx_deals_originating_lead on public.deals(originating_lead_id);
create index if not exists idx_deals_expected_decision on public.deals(expected_decision_at)
  where expected_decision_at is not null;
create index if not exists idx_deals_next_action on public.deals(next_action_at)
  where next_action_at is not null;
create index if not exists idx_deals_stage on public.deals(stage);

-- One active deal per originating lead (MVP idempotency)
create unique index if not exists deals_active_originating_lead_uidx
  on public.deals(originating_lead_id)
  where stage not in ('WON', 'LOST');

alter table public.deals enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Lead lifecycle columns + status CHECK expansion
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists qualified_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists customer_need text,
  add column if not exists decision_maker_status text,
  add column if not exists buying_timeframe text,
  add column if not exists active_deal_id uuid;

-- Expand status CHECK: keep legacy commercial statuses for historical rows;
-- new UX writes NEW|CONTACTED|QUALIFIED|CONVERTED_TO_DEAL|NOT_QUALIFIED.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check check (status in (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'CONVERTED_TO_DEAL',
    'NOT_QUALIFIED',
    -- Legacy commercial statuses (migrated rows / compatibility)
    'NEGOTIATING',
    'PROPOSAL_SENT',
    'WON',
    'LOST'
  ));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_decision_maker_status_check'
  ) then
    alter table public.leads
      add constraint leads_decision_maker_status_check
      check (
        decision_maker_status is null
        or decision_maker_status in ('YES', 'NO', 'UNKNOWN')
      );
  end if;
end $$;

-- active_deal_id FK added after deals exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_active_deal_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_active_deal_id_fkey
      foreign key (active_deal_id) references public.deals(id) on delete set null;
  end if;
end $$;

create index if not exists idx_leads_active_deal on public.leads(active_deal_id)
  where active_deal_id is not null;
create index if not exists idx_leads_converted_at on public.leads(converted_at)
  where converted_at is not null;

-- ---------------------------------------------------------------------------
-- 3. Related entity deal_id columns
-- ---------------------------------------------------------------------------
alter table public.quotations
  add column if not exists deal_id uuid references public.deals(id) on delete set null;
create index if not exists idx_quotations_deal on public.quotations(deal_id)
  where deal_id is not null;

alter table public.win_analysis
  add column if not exists deal_id uuid references public.deals(id) on delete set null;
create index if not exists idx_win_analysis_deal on public.win_analysis(deal_id)
  where deal_id is not null;

alter table public.call_logs
  add column if not exists deal_id uuid references public.deals(id) on delete set null;
create index if not exists idx_call_logs_deal on public.call_logs(deal_id)
  where deal_id is not null;

alter table public.lead_events
  add column if not exists deal_id uuid references public.deals(id) on delete set null;
create index if not exists idx_lead_events_deal on public.lead_events(deal_id, created_at desc)
  where deal_id is not null;

-- Expand sales_action_states source_entity_type to include deal
alter table public.sales_action_states
  drop constraint if exists sales_action_states_source_entity_type_check;
alter table public.sales_action_states
  add constraint sales_action_states_source_entity_type_check
  check (source_entity_type in ('lead', 'deal', 'quotation', 'task', 'goal', 'none'));

-- ---------------------------------------------------------------------------
-- 4. Contact lifecycle: consider deals
-- ---------------------------------------------------------------------------
create or replace function recompute_contact_lifecycle(p_contact_id uuid)
returns text
language plpgsql
as $$
declare
  v_new_lifecycle text;
  v_current text;
begin
  select lifecycle into v_current from contacts where id = p_contact_id;
  if not found then
    return null;
  end if;

  if v_current = 'customer' then
    return 'customer';
  end if;

  if exists (
    select 1 from deals d
    where d.contact_id = p_contact_id and d.stage = 'WON'
  ) or exists (
    select 1 from leads l
    where l.contact_id = p_contact_id and l.status = 'WON'
  ) then
    v_new_lifecycle := 'customer';
  elsif exists (
    select 1 from deals d
    where d.contact_id = p_contact_id
      and d.stage not in ('WON', 'LOST')
  ) or exists (
    select 1 from leads l
    where l.contact_id = p_contact_id
      and l.status not in (
        'WON', 'LOST', 'NOT_QUALIFIED', 'CONVERTED_TO_DEAL'
      )
  ) then
    v_new_lifecycle := 'pipeline';
  elsif exists (
    select 1 from call_logs cl
    join leads l on l.id = cl.lead_id
    where l.contact_id = p_contact_id
  ) then
    v_new_lifecycle := 'aware';
  else
    v_new_lifecycle := 'cold';
  end if;

  if v_new_lifecycle is distinct from v_current then
    update contacts
    set lifecycle = v_new_lifecycle, updated_at = now()
    where id = p_contact_id;
  end if;

  return v_new_lifecycle;
end;
$$;

create or replace function trg_deals_recompute_contact_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.contact_id is not null then
      perform recompute_contact_lifecycle(old.contact_id);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.contact_id is distinct from new.contact_id
    and old.contact_id is not null
  then
    perform recompute_contact_lifecycle(old.contact_id);
  end if;

  if new.contact_id is not null then
    perform recompute_contact_lifecycle(new.contact_id);
  end if;

  return new;
end;
$$;

drop trigger if exists deals_contact_lifecycle on public.deals;
create trigger deals_contact_lifecycle
  after insert or update of stage, contact_id or delete on public.deals
  for each row
  execute function trg_deals_recompute_contact_lifecycle();

-- ---------------------------------------------------------------------------
-- 5. Transactional create deal from lead (idempotent for active deals)
-- ---------------------------------------------------------------------------
create or replace function create_deal_from_lead(
  p_lead_id uuid,
  p_actor_id uuid,
  p_name text,
  p_service_summary text default null,
  p_stage text default 'QUALIFIED',
  p_value_status text default 'PENDING_ESTIMATE',
  p_value_basis text default null,
  p_estimated_value numeric default null,
  p_estimated_value_min numeric default null,
  p_estimated_value_max numeric default null,
  p_customer_budget numeric default null,
  p_sales_estimate numeric default null,
  p_expected_decision_at date default null,
  p_location text default null,
  p_buying_timeframe text default null,
  p_decision_maker_status text default null,
  p_decision_maker_name text default null,
  p_next_action_at timestamptz default null,
  p_next_action_label text default null,
  p_customer_need text default null
)
returns uuid
language plpgsql
as $$
declare
  v_lead public.leads%rowtype;
  v_existing_id uuid;
  v_deal_id uuid;
  v_now timestamptz := now();
  v_actor_name text;
  v_actor_role text;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if v_lead.status = 'NOT_QUALIFIED' then
    raise exception 'LEAD_NOT_QUALIFIED';
  end if;

  select d.id into v_existing_id
  from public.deals d
  where d.originating_lead_id = p_lead_id
    and d.stage not in ('WON', 'LOST')
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if p_stage is null or p_stage not in ('QUALIFIED', 'SCOPING', 'PROPOSAL_SENT', 'NEGOTIATING') then
    p_stage := 'QUALIFIED';
  end if;

  insert into public.deals (
    client_id,
    contact_id,
    originating_lead_id,
    owner_id,
    name,
    service_summary,
    stage,
    value_status,
    value_basis,
    estimated_value,
    estimated_value_min,
    estimated_value_max,
    customer_budget,
    sales_estimate,
    expected_decision_at,
    location,
    buying_timeframe,
    decision_maker_status,
    decision_maker_name,
    next_action_at,
    next_action_label,
    last_meaningful_activity_at,
    created_at,
    updated_at
  ) values (
    v_lead.client_id,
    v_lead.contact_id,
    v_lead.id,
    v_lead.assigned_to_id,
    coalesce(nullif(trim(p_name), ''), coalesce(nullif(trim(v_lead.project_type), ''), 'New opportunity')),
    p_service_summary,
    p_stage,
    coalesce(p_value_status, 'PENDING_ESTIMATE'),
    p_value_basis,
    p_estimated_value,
    p_estimated_value_min,
    p_estimated_value_max,
    p_customer_budget,
    p_sales_estimate,
    p_expected_decision_at,
    p_location,
    coalesce(p_buying_timeframe, v_lead.buying_timeframe, v_lead.timeline),
    coalesce(p_decision_maker_status, v_lead.decision_maker_status),
    p_decision_maker_name,
    coalesce(p_next_action_at, case when v_lead.follow_up_date is not null then v_lead.follow_up_date::timestamptz else null end),
    p_next_action_label,
    v_now,
    v_now,
    v_now
  )
  returning id into v_deal_id;

  update public.leads
  set
    status = 'CONVERTED_TO_DEAL',
    converted_at = coalesce(converted_at, v_now),
    qualified_at = coalesce(qualified_at, v_now),
    active_deal_id = v_deal_id,
    customer_need = coalesce(nullif(trim(p_customer_need), ''), customer_need),
    buying_timeframe = coalesce(p_buying_timeframe, buying_timeframe),
    decision_maker_status = coalesce(p_decision_maker_status, decision_maker_status),
    updated_at = v_now
  where id = p_lead_id;

  select name, role into v_actor_name, v_actor_role
  from public.users where id = p_actor_id;

  insert into public.lead_events (
    lead_id, client_id, deal_id, actor_id, actor_name, actor_role,
    event_type, event_data, created_at
  ) values (
    p_lead_id,
    v_lead.client_id,
    v_deal_id,
    p_actor_id,
    coalesce(v_actor_name, 'Unknown'),
    coalesce(v_actor_role, 'UNKNOWN'),
    'DEAL_CREATED',
    jsonb_build_object(
      'deal_id', v_deal_id,
      'deal_name', coalesce(nullif(trim(p_name), ''), coalesce(v_lead.project_type, 'New opportunity')),
      'stage', p_stage
    ),
    v_now
  );

  return v_deal_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Legacy backfill: commercial lead statuses → deals
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_deal_id uuid;
  v_stage text;
  v_value_status text;
  v_value_basis text;
  v_estimated numeric;
  v_sales_estimate numeric;
  v_name text;
  v_now timestamptz := now();
begin
  for r in
    select l.*
    from public.leads l
    where l.status in ('NEGOTIATING', 'PROPOSAL_SENT', 'WON', 'LOST')
      and not exists (
        select 1 from public.deals d where d.originating_lead_id = l.id
      )
  loop
    v_stage := case r.status
      when 'PROPOSAL_SENT' then 'PROPOSAL_SENT'
      when 'NEGOTIATING' then 'NEGOTIATING'
      when 'WON' then 'WON'
      when 'LOST' then 'LOST'
      else 'QUALIFIED'
    end;

    v_estimated := case
      when r.deal_value is not null and r.deal_value > 0 then r.deal_value
      else null
    end;
    v_sales_estimate := case
      when r.deal_value_source is distinct from 'proposal' and v_estimated is not null
        then v_estimated
      else null
    end;

    if v_estimated is null then
      v_value_status := 'PENDING_ESTIMATE';
      v_value_basis := null;
    elsif r.deal_value_source = 'proposal' then
      v_value_status := 'KNOWN';
      v_value_basis := 'LATEST_QUOTE';
    else
      v_value_status := 'KNOWN';
      v_value_basis := 'SALES_ESTIMATE';
    end if;

    v_name := coalesce(
      nullif(trim(r.project_type), ''),
      nullif(trim(r.name), '') || ' opportunity',
      'Migrated opportunity'
    );

    insert into public.deals (
      client_id,
      contact_id,
      originating_lead_id,
      owner_id,
      name,
      service_summary,
      stage,
      value_status,
      value_basis,
      estimated_value,
      sales_estimate,
      customer_budget,
      expected_decision_at,
      location,
      buying_timeframe,
      next_action_at,
      won_value,
      won_at,
      lost_at,
      lost_reason,
      last_meaningful_activity_at,
      metadata,
      created_at,
      updated_at
    ) values (
      r.client_id,
      r.contact_id,
      r.id,
      r.assigned_to_id,
      v_name,
      r.project_type,
      v_stage,
      v_value_status,
      v_value_basis,
      v_estimated,
      v_sales_estimate,
      null,
      r.expected_close_date,
      null,
      coalesce(r.buying_timeframe, r.timeline),
      case when r.follow_up_date is not null then r.follow_up_date::timestamptz else null end,
      case when r.status = 'WON' then v_estimated else null end,
      case when r.status = 'WON' then coalesce(r.updated_at, v_now) else null end,
      case when r.status = 'LOST' then coalesce(r.updated_at, v_now) else null end,
      case when r.status = 'LOST' then r.lost_reason else null end,
      coalesce(r.updated_at, r.created_at, v_now),
      jsonb_build_object('migrated_from_lead_status', r.status),
      coalesce(r.created_at, v_now),
      v_now
    )
    returning id into v_deal_id;

    update public.leads
    set
      status = 'CONVERTED_TO_DEAL',
      converted_at = coalesce(converted_at, v_now),
      qualified_at = coalesce(qualified_at, v_now),
      active_deal_id = case
        when v_stage in ('WON', 'LOST') then null
        else v_deal_id
      end,
      updated_at = v_now
    where id = r.id;

    update public.quotations
    set deal_id = v_deal_id
    where lead_id = r.id and deal_id is null;

    update public.win_analysis
    set deal_id = v_deal_id
    where lead_id = r.id and deal_id is null;

    update public.call_logs
    set deal_id = v_deal_id
    where lead_id = r.id and deal_id is null;

    insert into public.lead_events (
      lead_id, client_id, deal_id, actor_name, actor_role,
      event_type, event_data, created_at
    ) values (
      r.id,
      r.client_id,
      v_deal_id,
      'System',
      'SYSTEM',
      'DEAL_MIGRATED',
      jsonb_build_object(
        'deal_id', v_deal_id,
        'from_lead_status', r.status,
        'stage', v_stage
      ),
      v_now
    );
  end loop;
end $$;
