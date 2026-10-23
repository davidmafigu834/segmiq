-- Local representation of the migration already applied to project gnnqzboaeezzevlwwryp.
-- Reconciled from pg_catalog on 2026-10-23. Do not replay against that project.

create table public.platform_price_catalog (
  sku text not null,
  version text not null,
  name text not null,
  billing_unit text not null check (billing_unit in ('per_user_month','per_business_month','one_time')),
  price_usd_cents integer not null check (price_usd_cents >= 0),
  included_conversations integer check (included_conversations is null or included_conversations >= 0),
  included_ai_actions integer check (included_ai_actions is null or included_ai_actions >= 0),
  max_agent_configurations integer check (max_agent_configurations is null or max_agent_configurations > 0),
  effective_from date not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (sku, version)
);

insert into public.platform_price_catalog
  (sku,version,name,billing_unit,price_usd_cents,included_conversations,included_ai_actions,max_agent_configurations,effective_from)
values
  ('crm_starter','2026-10-22','SegmiQ Starter','per_user_month',1900,null,null,null,'2026-10-22'),
  ('crm_growth','2026-10-22','SegmiQ Growth','per_user_month',2900,null,null,null,'2026-10-22'),
  ('agentic_business','2026-10-22','SegmiQ Agentic Business','per_business_month',9900,500,100,1,'2026-10-22'),
  ('agentic_scale','2026-10-22','SegmiQ Agentic Scale','per_business_month',24900,2000,500,3,'2026-10-22'),
  ('ai_conversations_250','2026-10-22','250 additional AI conversations','one_time',2500,250,null,null,'2026-10-22'),
  ('onboarding_one_business','2026-10-22','CRM onboarding - one business','one_time',15000,null,null,null,'2026-10-22'),
  ('onboarding_two_businesses','2026-10-22','CRM onboarding - two businesses','one_time',25000,null,null,null,'2026-10-22'),
  ('onboarding_three_businesses','2026-10-22','CRM onboarding - three businesses','one_time',35000,null,null,null,'2026-10-22'),
  ('ai_activation_standard','2026-10-22','Standard Agentic AI activation','one_time',14900,null,null,null,'2026-10-22');

create table public.platform_commercial_accounts (
  client_id uuid primary key references public.clients(id) on delete restrict,
  crm_sku text not null check (crm_sku in ('crm_starter','crm_growth')),
  ai_sku text check (ai_sku is null or ai_sku in ('agentic_business','agentic_scale')),
  price_version text not null default '2026-10-22',
  purchased_seats integer not null check (purchased_seats > 0),
  status text not null default 'draft' check (status in ('draft','active','past_due','suspended','cancelled')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','annual')),
  renewal_at timestamptz,
  agreed_price_snapshot jsonb not null default '{}'::jsonb,
  agreement_ref text,
  legacy_subscription_id uuid references public.subscriptions(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_ai_requires_growth check (ai_sku is null or crm_sku = 'crm_growth'),
  foreign key (crm_sku,price_version) references public.platform_price_catalog(sku,version),
  foreign key (ai_sku,price_version) references public.platform_price_catalog(sku,version)
);

create table public.platform_plan_change_requests (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete restrict,
  requested_by uuid not null references public.users(id) on delete restrict, reviewed_by uuid references public.users(id) on delete set null,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','applied','cancelled')),
  current_snapshot jsonb not null default '{}'::jsonb, proposed_snapshot jsonb not null,
  effective_at timestamptz not null, charge_handling text not null check (charge_handling in ('prorate','waive','at_renewal')),
  reason text not null check (length(btrim(reason)) >= 3), idempotency_key text not null unique,
  review_note text, reviewed_at timestamptz, applied_at timestamptz, created_at timestamptz not null default now(),
  constraint applied_has_timestamp check (status <> 'applied' or applied_at is not null)
);

create table public.platform_grace_periods (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete restrict,
  granted_by uuid not null references public.users(id) on delete restrict, starts_at timestamptz not null default now(),
  ends_at timestamptz not null, reason text not null check (length(btrim(reason)) >= 3), customer_notified boolean not null default false,
  ended_at timestamptz, ended_by uuid references public.users(id) on delete set null, created_at timestamptz not null default now(),
  constraint grace_valid_duration check (ends_at > starts_at and ends_at <= starts_at + interval '30 days'),
  constraint ended_not_before_start check (ended_at is null or ended_at >= starts_at)
);

create table public.platform_commercial_audit_events (
  id bigint generated always as identity primary key, client_id uuid references public.clients(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null, event_type text not null, subject_table text not null,
  subject_id text not null, details jsonb not null default '{}'::jsonb, recorded_at timestamptz not null default now()
);

create table public.platform_ai_usage_ledger (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete restrict,
  usage_type text not null check (usage_type in ('customer_conversation','internal_ai_action')), units integer not null default 1 check (units > 0),
  event_key text not null, billing_period_start date not null, source_reference text, recorded_at timestamptz not null default now(),
  unique (client_id,usage_type,event_key)
);

create index platform_grace_periods_client_window_idx on public.platform_grace_periods(client_id,starts_at,ends_at);
create index platform_commercial_audit_events_client_idx on public.platform_commercial_audit_events(client_id,recorded_at desc);
create index platform_ai_usage_client_period_idx on public.platform_ai_usage_ledger(client_id,billing_period_start,usage_type);

create function public.platform_deny_history_modifications() returns trigger language plpgsql set search_path = pg_catalog as $$
begin raise exception 'Commercial history is append-only; record a correction event instead'; end $$;
create trigger platform_price_versions_immutable before update or delete on public.platform_price_catalog for each row execute function public.platform_deny_history_modifications();
create trigger platform_audit_events_immutable before update or delete on public.platform_commercial_audit_events for each row execute function public.platform_deny_history_modifications();
create trigger platform_ai_usage_immutable before update or delete on public.platform_ai_usage_ledger for each row execute function public.platform_deny_history_modifications();

alter table public.platform_price_catalog enable row level security;
alter table public.platform_commercial_accounts enable row level security;
alter table public.platform_plan_change_requests enable row level security;
alter table public.platform_grace_periods enable row level security;
alter table public.platform_commercial_audit_events enable row level security;
alter table public.platform_ai_usage_ledger enable row level security;
revoke all on public.platform_price_catalog, public.platform_commercial_accounts, public.platform_plan_change_requests,
  public.platform_grace_periods, public.platform_commercial_audit_events, public.platform_ai_usage_ledger from anon, authenticated;
grant all on public.platform_price_catalog, public.platform_commercial_accounts, public.platform_plan_change_requests,
  public.platform_grace_periods, public.platform_commercial_audit_events, public.platform_ai_usage_ledger to service_role;
