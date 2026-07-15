-- Persistent AI response cache.
-- Prevents page refreshes and repeated reads from generating identical Claude responses.

create table if not exists public.ai_response_cache (
  cache_key text primary key,
  feature text not null,
  client_id uuid references public.clients(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  input_hash text not null,
  response jsonb not null,
  model text not null,
  prompt_version integer not null default 1,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists ai_response_cache_client_feature_idx
  on public.ai_response_cache (client_id, feature, generated_at desc);

create index if not exists ai_response_cache_lead_feature_idx
  on public.ai_response_cache (lead_id, feature, generated_at desc)
  where lead_id is not null;

create index if not exists ai_response_cache_expires_idx
  on public.ai_response_cache (expires_at);

alter table public.ai_response_cache enable row level security;

comment on table public.ai_response_cache is
  'Server-only cache for generated AI responses. Accessed with the service-role client.';
