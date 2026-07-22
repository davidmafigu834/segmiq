-- Allow client managers to opt into salesperson capabilities (calls, lead actions, round-robin).
alter table public.users
  add column if not exists also_sells boolean not null default false;

comment on column public.users.also_sells is
  'When true on CLIENT_MANAGER, user can log calls, work assigned leads, join round-robin, and access the sales portal.';

alter table public.users
  drop constraint if exists users_also_sells_manager_only;

alter table public.users
  add constraint users_also_sells_manager_only
  check (also_sells = false or role = 'CLIENT_MANAGER');
