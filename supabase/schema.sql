-- Leadstaq — full database schema (PostgreSQL / Supabase)
-- Safe to run on an existing database: after CREATE TABLE IF NOT EXISTS (no-op when tables exist),
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS backfills Facebook and other columns from newer migrations.
-- For call_logs outcome changes on very old DBs only, also run migrations/002_add_lost_outcome.sql.
-- Application uses the Supabase JS client with the service role on the server.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null,
  slug text not null unique,
  logo_url text,
  primary_color text default '#00D4FF',
  response_time_limit_hours int not null default 2,
  round_robin_index int not null default 0,
  twilio_whatsapp_override text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fb_access_token text,
  fb_access_token_expires_at timestamptz,
  fb_page_id text,
  fb_page_name text,
  fb_form_id text,
  fb_form_name text,
  fb_webhook_verified boolean default false,
  fb_token_expired_at timestamptz,
  last_lead_received_at timestamptz
);

-- If `clients` already existed (e.g. from an older migration), CREATE above is a no-op — add missing columns.
alter table public.clients
  add column if not exists fb_access_token text,
  add column if not exists fb_access_token_expires_at timestamptz,
  add column if not exists fb_page_id text,
  add column if not exists fb_page_name text,
  add column if not exists fb_form_id text,
  add column if not exists fb_form_name text,
  add column if not exists fb_webhook_verified boolean default false,
  add column if not exists last_lead_received_at timestamptz,
  add column if not exists agency_managed boolean not null default true,
  add column if not exists agency_managed_changed_at timestamptz;

-- ---------------------------------------------------------------------------
-- users (references clients; clients.fb_connected_by_user_id added after)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null check (role in ('SUPER_ADMIN', 'CLIENT_MANAGER', 'SALESPERSON')),
  client_id uuid references public.clients(id) on delete set null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_client on public.users(client_id);
create index if not exists idx_users_email on public.users(email);

alter table public.clients
  add column if not exists fb_connected_by_user_id uuid references public.users(id) on delete set null;
alter table public.clients
  add column if not exists fb_connected_at timestamptz;

alter table public.clients
  add column if not exists agency_managed_changed_by uuid references public.users(id) on delete set null;

alter table public.clients
  add column if not exists fb_ad_account_id text;

alter table public.clients
  add column if not exists fb_user_access_token text;

alter table public.clients
  add column if not exists fb_token_expired_at timestamptz;

comment on column public.clients.fb_access_token_expires_at is 'Long-lived user or page token expiry (from Graph expires_in)';
comment on column public.clients.fb_page_name is 'Selected Facebook Page name';
comment on column public.clients.fb_connected_by_user_id is 'Super admin who completed OAuth';
comment on column public.clients.fb_connected_at is 'When Facebook OAuth completed';

comment on column public.clients.fb_ad_account_id is 'Facebook Ads account id, e.g. act_123456789';
comment on column public.clients.fb_user_access_token is 'Long-lived user token for Marketing API (preserved when fb_access_token is replaced by page token)';

comment on column public.clients.fb_token_expired_at is 'Set when Graph reports OAuth token expiry; cleared on successful OAuth reconnect.';

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_to_id uuid references public.users(id) on delete set null,
  source text not null check (source in ('LANDING_PAGE', 'FACEBOOK', 'MANUAL')),
  status text not null check (status in (
    'NEW', 'CONTACTED', 'NEGOTIATING', 'PROPOSAL_SENT', 'WON', 'LOST', 'NOT_QUALIFIED'
  )),
  form_data jsonb not null default '{}',
  name text,
  phone text,
  email text,
  budget text,
  project_type text,
  timeline text,
  magic_token text unique,
  magic_token_expires_at timestamptz,
  not_qualified_reason text,
  lost_reason text,
  deal_value numeric,
  follow_up_date date,
  facebook_lead_id text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists lost_reason text;

alter table public.leads
  add column if not exists facebook_lead_id text;

create unique index if not exists leads_facebook_lead_id_unique
  on public.leads (client_id, facebook_lead_id)
  where facebook_lead_id is not null;

create index if not exists leads_facebook_lead_id_lookup
  on public.leads (facebook_lead_id)
  where facebook_lead_id is not null;

comment on column public.leads.facebook_lead_id is 'Meta leadgen_id; unique per client for dedup.';

create index if not exists idx_leads_client on public.leads(client_id);
create index if not exists idx_leads_assigned on public.leads(assigned_to_id);
create index if not exists idx_leads_magic on public.leads(magic_token);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_created on public.leads(created_at);

-- ---------------------------------------------------------------------------
-- call_logs
-- ---------------------------------------------------------------------------
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  outcome text not null,
  notes text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  constraint call_logs_outcome_check check (outcome in (
    'ANSWERED', 'NO_ANSWER', 'FOLLOW_UP', 'WON', 'LOST', 'NOT_QUALIFIED'
  ))
);

create index if not exists idx_call_logs_lead on public.call_logs(lead_id);

-- ---------------------------------------------------------------------------
-- form_schemas
-- ---------------------------------------------------------------------------
create table if not exists public.form_schemas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  fields jsonb not null default '[]',
  thank_you_message text,
  form_title text default 'Contact us',
  submit_button_text text default 'Submit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- landing_pages
-- ---------------------------------------------------------------------------
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  hero_headline text,
  hero_subheadline text,
  hero_image_url text,
  about_text text,
  about_image_url text,
  about_company_name text,
  about_tagline text,
  about_stats text,
  services jsonb default '[]',
  projects jsonb default '[]',
  testimonials jsonb default '[]',
  cta_text text,
  primary_color text,
  font_choice text,
  published boolean default false,
  custom_domain text,
  footer_contact text,
  footer_social jsonb default '[]',
  footer_copyright text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in (
    'NEW_LEAD', 'FOLLOW_UP_DUE', 'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT'
  )),
  message text not null,
  read boolean not null default false,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(read);

-- ---------------------------------------------------------------------------
-- message_logs (outbound WhatsApp Meta + Resend delivery audit)
-- ---------------------------------------------------------------------------
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  notification_type text not null,
  recipient text not null,
  template_key text,
  status text not null check (status in ('pending', 'sent', 'failed', 'delivered', 'read')),
  provider_id text,
  error_message text,
  error_code text,
  payload_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_logs_lead_id on public.message_logs(lead_id);
create index if not exists message_logs_user_id_created_at on public.message_logs(user_id, created_at desc);
create index if not exists message_logs_status_created_at on public.message_logs(status, created_at desc);
create index if not exists message_logs_provider_id on public.message_logs(provider_id) where provider_id is not null;

-- ---------------------------------------------------------------------------
-- agency_settings (singleton)
-- ---------------------------------------------------------------------------
create table if not exists public.agency_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  agency_name text,
  logo_url text,
  default_response_time_limit_hours int not null default 2,
  default_currency text not null default 'USD',
  default_timezone text not null default 'America/New_York',
  terms_url text,
  privacy_url text,
  updated_at timestamptz not null default now()
);

insert into public.agency_settings (id) values ('singleton') on conflict (id) do nothing;

alter table public.users
  add column if not exists avatar_url text,
  add column if not exists notification_prefs jsonb default '{"whatsapp":true,"email":true,"followUpReminders":true}'::jsonb,
  add column if not exists session_version int not null default 0,
  add column if not exists round_robin_order int not null default 0;

alter table public.clients
  add column if not exists manager_notification_prefs jsonb default '{"newLead":true,"dealWon":true,"overdueLead":true}'::jsonb,
  add column if not exists is_archived boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS (service role bypasses; anon blocked until policies are added)
-- ---------------------------------------------------------------------------
alter table public.agency_settings enable row level security;
alter table public.clients enable row level security;
alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.call_logs enable row level security;
alter table public.form_schemas enable row level security;
alter table public.landing_pages enable row level security;
alter table public.notifications enable row level security;
alter table public.message_logs enable row level security;
