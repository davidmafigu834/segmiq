-- Phase 6: Organisation security policy + website API key hashing (additive)

alter table public.clients
  add column if not exists security_policy jsonb not null default '{}'::jsonb;

comment on column public.clients.security_policy is
  'Organisation security settings: mfaRequirement, idleTtlHours, absoluteTtlHours, mfaGraceUntil, allowDataExports. Server enforces safe bounds.';

alter table public.clients
  add column if not exists website_integration_api_key_hash text,
  add column if not exists website_integration_api_key_prefix text;

create unique index if not exists idx_clients_website_api_key_hash
  on public.clients (website_integration_api_key_hash)
  where website_integration_api_key_hash is not null;

comment on column public.clients.website_integration_api_key_hash is
  'SHA-256 hex of website integration API key. Prefer over plaintext column.';
comment on column public.clients.website_integration_api_key_prefix is
  'Non-secret prefix for UI masking (e.g. sk_live_xxxx).';

-- Optional: track when client was suspended for security (billing already has subscription status)
alter table public.clients
  add column if not exists security_suspended_at timestamptz;

comment on column public.clients.security_suspended_at is
  'When set, non-platform users of this tenant cannot use the product.';
