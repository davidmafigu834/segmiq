-- 059_salesperson_saved_items.sql
-- Per-rep reusable quote line items (personal library, separate from manager product_catalog).

create table if not exists public.salesperson_saved_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  unit_price numeric not null default 0,
  category text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_items_client_user
  on public.salesperson_saved_items(client_id, user_id, is_active);
