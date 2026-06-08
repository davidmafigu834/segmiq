-- Inbound submissions from the public marketing site (Book a demo, Contact, Become a partner,
-- careers). These appear in the Agency Admin portal so the team can action them.
-- Inserts happen server-side (server action with the service/elevated client), so RLS only
-- needs to allow authenticated staff to read/manage. No public/anon access to the table.

create table if not exists public.marketing_submissions (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('demo','contact','partner','career')),
  name         text not null,
  email        text not null,
  phone        text,
  company      text,
  market       text,
  industry     text,
  team_size    text,
  lead_volume  text,
  role         text,
  message      text,
  source       text,
  status       text not null default 'new' check (status in ('new','contacted','converted','archived')),
  created_at   timestamptz not null default now()
);

create index if not exists marketing_submissions_status_idx on public.marketing_submissions (status, created_at desc);
create index if not exists marketing_submissions_type_idx   on public.marketing_submissions (type);

alter table public.marketing_submissions enable row level security;

drop policy if exists "submissions staff manage" on public.marketing_submissions;
create policy "submissions staff manage"
  on public.marketing_submissions for all
  to authenticated
  using (true) with check (true);

-- NOTE: do NOT add an anon insert policy. Submissions are written by a trusted server action
-- using the service role (or an elevated server client), which bypasses RLS.
