-- 067_cloud_client_signup_backfill.sql
-- Include cloud tenants that were left as signup_source = 'agency' after 041.

update public.clients c
set signup_source = 'cloud'
where c.signup_source = 'agency'
  and (
    exists (select 1 from public.projects p where p.client_id = c.id)
    or (
      not exists (select 1 from public.form_schemas fs where fs.client_id = c.id)
      and exists (
        select 1 from public.users u
        where u.client_id = c.id and u.role = 'CLIENT_MANAGER'
      )
    )
  );
