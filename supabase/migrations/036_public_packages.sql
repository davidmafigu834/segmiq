-- 036_public_packages.sql
-- Public package page fields (additive only)

alter table pricing_packages
  add column if not exists slug text,
  add column if not exists is_public boolean not null default false,
  add column if not exists tagline text,
  add column if not exists price_note text;

create unique index if not exists pricing_packages_client_slug_idx
  on pricing_packages (client_id, slug)
  where slug is not null;
