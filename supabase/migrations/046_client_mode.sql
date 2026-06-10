-- Solo vs team operator mode on CRM clients.
alter table public.clients
  add column if not exists mode text not null default 'team'
  check (mode in ('team', 'solo'));

update public.clients set mode = 'team' where mode is null;
