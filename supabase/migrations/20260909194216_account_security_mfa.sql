-- Phase 4: Account security — MFA, recovery codes, challenges, session strength
-- Additive only. Does not alter WhatsApp QR session tables.
-- Never store plaintext TOTP secrets or recovery codes.

alter table public.users
  add column if not exists password_changed_at timestamptz;

comment on column public.users.password_changed_at is
  'Set when the user (or reset flow) changes password. Null means unknown / pre-Phase-4.';

alter table public.user_sessions
  add column if not exists mfa_verified_at timestamptz,
  add column if not exists auth_strength text,
  add column if not exists elevated_until timestamptz;

comment on column public.user_sessions.mfa_verified_at is
  'When MFA was satisfied for this login session (null if password-only).';
comment on column public.user_sessions.auth_strength is
  'password | password_mfa';
comment on column public.user_sessions.elevated_until is
  'Step-up / recent reauth window end (server-authoritative).';

create table if not exists public.user_mfa_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('TOTP')),
  status text not null check (status in ('pending', 'active', 'disabled')),
  secret_encrypted jsonb not null,
  created_at timestamptz not null default now(),
  setup_expires_at timestamptz,
  enabled_at timestamptz,
  last_used_at timestamptz,
  disabled_at timestamptz
);

create unique index if not exists idx_user_mfa_methods_one_active_totp
  on public.user_mfa_methods (user_id)
  where type = 'TOTP' and status in ('pending', 'active');

create index if not exists idx_user_mfa_methods_user_id
  on public.user_mfa_methods (user_id);

comment on table public.user_mfa_methods is
  'Human account MFA factors (TOTP first). Secrets are AES-GCM envelopes; never plaintext.';

create table if not exists public.user_mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null,
  batch_id uuid not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists idx_user_mfa_recovery_user
  on public.user_mfa_recovery_codes (user_id);
create index if not exists idx_user_mfa_recovery_unused
  on public.user_mfa_recovery_codes (user_id)
  where used_at is null;

comment on table public.user_mfa_recovery_codes is
  'Single-use MFA recovery codes stored as irreversible hashes only.';

create table if not exists public.user_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('login', 'step_up')),
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_auth_challenges_user
  on public.user_auth_challenges (user_id);
create index if not exists idx_user_auth_challenges_expires
  on public.user_auth_challenges (expires_at);

comment on table public.user_auth_challenges is
  'Short-lived pre-session MFA / step-up challenges. Not a SegmiQ session.';

alter table public.user_mfa_methods enable row level security;
alter table public.user_mfa_recovery_codes enable row level security;
alter table public.user_auth_challenges enable row level security;
