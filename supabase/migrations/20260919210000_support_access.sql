-- Platform staff privileged client-data access ("Support Access").
--
-- SegmiQ platform administration (organisations, billing, integration health)
-- is separate from client business-data access. A SUPER_ADMIN may administer an
-- organisation without permission to read its CRM records. Reading client data
-- requires a scoped, reason-bound, time-limited, revocable grant recorded here.
--
-- Tenant key is client_id (SegmiQ organisation boundary).
-- Service role bypasses RLS; anon/authenticated are denied.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
create table if not exists public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  -- Short human reference shown in support tooling and to the organisation.
  reference text not null unique,
  admin_user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'PENDING' check (status in (
    'PENDING', 'APPROVED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'DENIED'
  )),
  -- BREAK_GLASS is an emergency variant with a shorter ceiling and its own permission.
  access_kind text not null default 'SUPPORT' check (access_kind in ('SUPPORT', 'BREAK_GLASS')),
  approval_mode text not null default 'SELF_APPROVAL' check (approval_mode in (
    'SELF_APPROVAL', 'SECOND_ADMIN_REQUIRED', 'CLIENT_APPROVAL'
  )),
  -- Requested data categories. Empty array grants nothing.
  scopes text[] not null default '{}',
  reason text not null,
  ticket_reference text,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 240),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by_user_id uuid references public.users(id) on delete set null,
  approved_by_kind text check (approved_by_kind in ('SELF', 'PLATFORM_ADMIN', 'CLIENT_ADMIN')),
  denied_at timestamptz,
  denied_by_user_id uuid references public.users(id) on delete set null,
  denial_reason text,
  started_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.users(id) on delete set null,
  revoked_reason text,
  request_ip text,
  request_user_agent text,
  -- SegmiQ login session that requested the grant (not a WhatsApp provider session).
  session_id uuid references public.user_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_access_grants is
  'Scoped, time-limited grants that let SegmiQ platform staff read one organisation''s client data. Never store customer content here.';
comment on column public.support_access_grants.scopes is
  'Data categories: CUSTOMER_PROFILES, LEADS, DEALS, CONVERSATIONS, QUOTATIONS, DOCUMENTS, FILES, AGENT_ACTIVITY.';

create index if not exists idx_support_access_grants_admin
  on public.support_access_grants (admin_user_id, status);
create index if not exists idx_support_access_grants_client
  on public.support_access_grants (client_id, requested_at desc);
create index if not exists idx_support_access_grants_status
  on public.support_access_grants (status);
create index if not exists idx_support_access_grants_expires
  on public.support_access_grants (expires_at)
  where status = 'ACTIVE';
-- One live grant per administrator per organisation keeps the active context unambiguous.
create unique index if not exists uq_support_access_grants_active
  on public.support_access_grants (admin_user_id, client_id)
  where status in ('PENDING', 'APPROVED', 'ACTIVE');

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.support_access_events (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references public.support_access_grants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  event_type text not null,
  -- Data category the action touched (null for lifecycle events).
  scope text,
  resource_type text,
  -- Resource identifier only — never a name, phone number, or message body.
  resource_id text,
  outcome text not null default 'SUCCESS' check (outcome in ('SUCCESS', 'DENIED', 'ERROR')),
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.support_access_events is
  'Privileged-access audit trail. Records identifiers and outcomes only — never customer content, credentials, or tokens.';

create index if not exists idx_support_access_events_grant
  on public.support_access_events (grant_id, created_at desc);
create index if not exists idx_support_access_events_client
  on public.support_access_events (client_id, created_at desc);
create index if not exists idx_support_access_events_actor
  on public.support_access_events (actor_user_id, created_at desc);
create index if not exists idx_support_access_events_type
  on public.support_access_events (event_type);

-- ---------------------------------------------------------------------------
-- RLS: service role only (application enforces authorisation)
-- ---------------------------------------------------------------------------
alter table public.support_access_grants enable row level security;
alter table public.support_access_events enable row level security;
