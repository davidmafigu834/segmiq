-- Zoho Books connection for one SegmiQ company.
-- Tokens are sealed AES-GCM payloads. This migration does not store secrets.
-- CRM users sign in with NextAuth, not Supabase Auth, so these tables are
-- default-deny: RLS on, grants revoked from anon and authenticated.
-- The Next.js server uses the service role and must filter by client_id.

create table if not exists public.zoho_books_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  status text not null default 'disconnected'
    check (status in ('pending_organisation', 'connected', 'reconnect_required', 'disconnected')),
  zoho_organization_id text,
  zoho_organization_name text,
  accounts_server text,
  api_domain text,
  location text,
  scopes text[] not null default '{}',
  refresh_token_sealed text,
  access_token_sealed text,
  access_token_expires_at timestamptz,
  refresh_lock_until timestamptz,
  connected_by_user_id uuid references public.users(id) on delete set null,
  connected_at timestamptz,
  last_tested_at timestamptz,
  last_error text,
  disconnected_at timestamptz,
  sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoho_books_connections_accounts_server_check check (
    accounts_server is null or accounts_server in (
      'https://accounts.zoho.com',
      'https://accounts.zoho.eu',
      'https://accounts.zoho.in',
      'https://accounts.zoho.com.au',
      'https://accounts.zoho.jp',
      'https://accounts.zoho.ca',
      'https://accounts.zoho.com.cn',
      'https://accounts.zoho.sa',
      'https://accounts.zoho.ae'
    )
  ),
  constraint zoho_books_connections_api_domain_check check (
    api_domain is null or api_domain in (
      'https://www.zohoapis.com',
      'https://www.zohoapis.eu',
      'https://www.zohoapis.in',
      'https://www.zohoapis.com.au',
      'https://www.zohoapis.jp',
      'https://www.zohoapis.ca',
      'https://www.zohoapis.com.cn',
      'https://www.zohoapis.sa',
      'https://www.zohoapis.ae'
    )
  ),
  constraint zoho_books_connections_location_check check (
    location is null or location in ('us', 'eu', 'in', 'au', 'jp', 'ca', 'cn', 'sa', 'ae')
  )
);

create unique index if not exists zoho_books_connections_org_idx
  on public.zoho_books_connections (zoho_organization_id)
  where zoho_organization_id is not null;

comment on table public.zoho_books_connections is
  'One Zoho Books connection per SegmiQ company. Sealed tokens are server-only.';
comment on column public.zoho_books_connections.sync_enabled is
  'Phase 1 keeps this false. No Zoho background job may run while it is false.';

create table if not exists public.zoho_books_organization_claims (
  zoho_organization_id text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists zoho_books_organization_claims_client_idx
  on public.zoho_books_organization_claims (client_id);

comment on table public.zoho_books_organization_claims is
  'Reserves a Zoho Books organisation for one SegmiQ company so two companies cannot share it.';

create table if not exists public.zoho_books_record_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  connection_id uuid not null references public.zoho_books_connections(id) on delete cascade,
  zoho_organization_id text not null,
  resource_type text not null check (resource_type in ('customer', 'item')),
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (client_id, zoho_organization_id, resource_type, external_id)
);

create index if not exists zoho_books_record_links_client_org_idx
  on public.zoho_books_record_links (client_id, zoho_organization_id);

comment on table public.zoho_books_record_links is
  'Future external-record mappings. Phase 1 does not insert rows. Links stay with their organisation id.';

create table if not exists public.zoho_books_oauth_states (
  state_hash text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  session_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists zoho_books_oauth_states_expires_idx
  on public.zoho_books_oauth_states (expires_at);

comment on table public.zoho_books_oauth_states is
  'Single-use OAuth state hashes. The raw state is never stored.';

create table if not exists public.zoho_books_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists zoho_books_events_client_idx
  on public.zoho_books_events (client_id, created_at desc);

comment on table public.zoho_books_events is
  'Connection audit. Do not store tokens, authorization codes, or client secrets.';

alter table public.zoho_books_connections enable row level security;
alter table public.zoho_books_organization_claims enable row level security;
alter table public.zoho_books_record_links enable row level security;
alter table public.zoho_books_oauth_states enable row level security;
alter table public.zoho_books_events enable row level security;

revoke all on public.zoho_books_connections from public, anon, authenticated;
revoke all on public.zoho_books_organization_claims from public, anon, authenticated;
revoke all on public.zoho_books_record_links from public, anon, authenticated;
revoke all on public.zoho_books_oauth_states from public, anon, authenticated;
revoke all on public.zoho_books_events from public, anon, authenticated;

grant all on public.zoho_books_connections to service_role;
grant all on public.zoho_books_organization_claims to service_role;
grant all on public.zoho_books_record_links to service_role;
grant all on public.zoho_books_oauth_states to service_role;
grant all on public.zoho_books_events to service_role;
