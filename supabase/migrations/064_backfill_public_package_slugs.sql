-- 064_backfill_public_package_slugs.sql
-- Packages marked public but missing a slug never appear on the profile page.

update pricing_packages p
set slug = sub.generated_slug
from (
  select
    id,
    coalesce(
      nullif(
        trim(both '-' from lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g'))),
        ''
      ),
      'package-' || left(replace(id::text, '-', ''), 8)
    ) as generated_slug
  from pricing_packages
  where is_active = true
    and is_public = true
    and (slug is null or btrim(slug) = '')
) sub
where p.id = sub.id;

-- Resolve duplicate slugs within the same client by suffixing with id fragment.
update pricing_packages p
set slug = p.slug || '-' || left(replace(p.id::text, '-', ''), 6)
where p.is_active = true
  and p.is_public = true
  and p.slug is not null
  and exists (
    select 1
    from pricing_packages dup
    where dup.client_id = p.client_id
      and dup.slug = p.slug
      and dup.id <> p.id
      and dup.is_active = true
  );
