-- Bootstrap explicit Customer directory fields for records created before the
-- Company Customers model existed.

-- Contacts historically represented people. Preserve that existing business
-- meaning by classifying untyped legacy Customers as Individuals. Companies
-- created in the new flow are always explicitly classified at write time.
update public.contacts
set customer_type = 'individual',
    updated_at = now()
where lifecycle = 'customer'
  and customer_type is null;

-- Seed the stable relationship owner from the strongest existing ownership
-- fact: most recently updated active Deal, then any Deal, then newest Lead.
with owner_candidates as (
  select distinct on (contact_id)
    contact_id,
    owner_id
  from (
    select
      d.contact_id,
      d.owner_id,
      case when d.stage in ('QUALIFIED', 'SCOPING', 'PROPOSAL_SENT', 'NEGOTIATING') then 3 else 2 end as rank,
      d.updated_at as activity_at
    from public.deals d
    where d.contact_id is not null and d.owner_id is not null
    union all
    select
      l.contact_id,
      l.assigned_to_id as owner_id,
      1 as rank,
      l.created_at as activity_at
    from public.leads l
    where l.contact_id is not null and l.assigned_to_id is not null
  ) candidates
  order by contact_id, rank desc, activity_at desc
)
update public.contacts c
set relationship_owner_id = oc.owner_id,
    updated_at = now()
from owner_candidates oc
where c.id = oc.contact_id
  and c.lifecycle = 'customer'
  and c.relationship_owner_id is null;
