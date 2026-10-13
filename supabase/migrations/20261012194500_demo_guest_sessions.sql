-- Guest demonstration sessions. Service role only.
-- Does not alter production CRM rows or the existing organisation-level mutation log.

create table if not exists public.demo_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint demo_invitations_id_client_unique unique (id, client_id)
);

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.demo_invitations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  persona_key text not null,
  secret_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint demo_sessions_invitation_client_match
    foreign key (invitation_id, client_id)
    references public.demo_invitations (id, client_id)
    on delete cascade
);

create index if not exists demo_sessions_invitation_id_idx
  on public.demo_sessions (invitation_id);

create table if not exists public.demo_session_mutations (
  session_id uuid primary key references public.demo_sessions(id) on delete cascade,
  mutations jsonb not null default '[]'::jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint demo_session_mutations_version_nonnegative check (version >= 0),
  constraint demo_mutations_must_be_array check (jsonb_typeof(mutations) = 'array')
);

-- Compare-and-swap is one UPDATE filtered by session_id and version.
-- Postgres locks the primary-key row for that statement, so a concurrent
-- writer either updates the matching version or changes zero rows.

alter table public.demo_invitations enable row level security;
alter table public.demo_sessions enable row level security;
alter table public.demo_session_mutations enable row level security;

revoke all on table public.demo_invitations from anon, authenticated;
revoke all on table public.demo_sessions from anon, authenticated;
revoke all on table public.demo_session_mutations from anon, authenticated;

grant select, insert, update, delete on table public.demo_invitations to service_role;
grant select, insert, update, delete on table public.demo_sessions to service_role;
grant select, insert, update, delete on table public.demo_session_mutations to service_role;

comment on table public.demo_invitations is
  'Hashed guest-demo invitation tokens. The raw token is never stored.';
comment on table public.demo_sessions is
  'Per-visitor demo sessions. secret_hash is not the invitation token.';
comment on table public.demo_session_mutations is
  'Append-only operational changes for one visitor. Not shared across sessions.';
