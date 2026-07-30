-- Enterprise tenancy: SUPER_ADMIN platform role + optional managed-agency flag per client.

-- 1) clients.agency_managed (relationship / portfolio flag; Meta+billing stay Super Admin)
alter table public.clients
  add column if not exists agency_managed boolean not null default true;

alter table public.clients
  add column if not exists agency_managed_changed_at timestamptz;

alter table public.clients
  add column if not exists agency_managed_changed_by uuid references public.users(id) on delete set null;

comment on column public.clients.agency_managed is
  'When true, Segmiq is the client''s managed marketing partner. When false, client is self-serve; Super Admin still owns Meta/billing access.';

comment on column public.clients.agency_managed_changed_at is
  'When agency_managed was last toggled.';

comment on column public.clients.agency_managed_changed_by is
  'User who last toggled agency_managed.';

-- Cloud / self-serve tenants default to not managed
update public.clients
set agency_managed = false
where coalesce(signup_source, 'agency') = 'cloud'
  and agency_managed = true;

-- 2) Rename AGENCY_ADMIN → SUPER_ADMIN on users.role
-- Drop role check(s) first so the update is allowed.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'users'
      and c.contype = 'c'
      and (
        pg_get_constraintdef(c.oid) ilike '%AGENCY_ADMIN%'
        or pg_get_constraintdef(c.oid) ilike '%role%'
      )
  loop
    execute format('alter table public.users drop constraint %I', r.conname);
  end loop;
end $$;

update public.users
set role = 'SUPER_ADMIN'
where role = 'AGENCY_ADMIN';

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('SUPER_ADMIN', 'CLIENT_MANAGER', 'SALESPERSON'));
