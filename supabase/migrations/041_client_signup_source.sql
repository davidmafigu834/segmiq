-- 041_client_signup_source.sql
-- Distinguish agency-onboarded CRM clients from Segmiq Cloud self-signups.

alter table public.clients
  add column if not exists signup_source text not null default 'agency'
  check (signup_source in ('agency', 'cloud'));

-- Best-effort backfill: agency client creation always seeds form_schemas; cloud signup does not.
update public.clients c
set signup_source = 'cloud'
where c.signup_source = 'agency'
  and not exists (
    select 1 from public.form_schemas fs where fs.client_id = c.id
  )
  and exists (
    select 1 from public.users u
    where u.client_id = c.id and u.role = 'CLIENT_MANAGER'
  );
