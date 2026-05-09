-- =============================================================
-- 023_project_milestones.sql
-- Project timeline / milestone system
-- =============================================================

-- Milestones table
create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  description text,
  milestone_date date not null,
  display_order integer default 0,
  is_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Link media to milestones
-- milestone_id is nullable — photos without a milestone
-- still belong to the project, just not to a specific stage
alter table project_media
  add column if not exists milestone_id uuid
  references project_milestones(id) on delete set null;

-- Indexes
create index if not exists project_milestones_project_id_idx
  on project_milestones(project_id);

create index if not exists project_milestones_date_idx
  on project_milestones(project_id, milestone_date asc);

create index if not exists project_media_milestone_id_idx
  on project_media(milestone_id);

-- RLS
alter table project_milestones enable row level security;

-- Agency and client users can CRUD their own milestones
create policy "milestones_owner_all" on project_milestones
  for all
  using (
    client_id in (
      select client_id from users where id = auth.uid()
    )
  );

-- Public can read milestones for public projects
create policy "milestones_public_read" on project_milestones
  for select
  to anon
  using (
    project_id in (
      select id from projects where is_public = true
    )
  );

-- Updated_at trigger
create or replace function update_milestone_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger milestone_updated_at
  before update on project_milestones
  for each row execute function update_milestone_updated_at();
