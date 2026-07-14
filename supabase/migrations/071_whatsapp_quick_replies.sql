-- Per-rep and team quick replies for WhatsApp Sales Hub.

create table if not exists public.whatsapp_quick_replies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_quick_replies_client_user
  on public.whatsapp_quick_replies (client_id, user_id, is_active);

alter table public.whatsapp_quick_replies enable row level security;
