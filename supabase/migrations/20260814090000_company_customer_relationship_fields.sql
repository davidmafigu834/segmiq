-- Canonical Company Customers directory fields.
-- Existing Customer records remain unclassified until a user explicitly sets
-- their type; no company/individual truth is inferred from names or Deals.

alter table public.contacts
  add column if not exists customer_type text,
  add column if not exists primary_contact_name text,
  add column if not exists industry text,
  add column if not exists relationship_owner_id uuid references public.users(id) on delete set null;

alter table public.contacts drop constraint if exists contacts_customer_type_check;
alter table public.contacts
  add constraint contacts_customer_type_check
  check (customer_type is null or customer_type in ('company', 'individual'));

create index if not exists idx_contacts_client_customer_type
  on public.contacts (client_id, customer_type)
  where lifecycle = 'customer';

create index if not exists idx_contacts_client_relationship_owner
  on public.contacts (client_id, relationship_owner_id)
  where lifecycle = 'customer';

comment on column public.contacts.customer_type is
  'Explicit Company Customer classification. Null means not yet classified.';
comment on column public.contacts.relationship_owner_id is
  'Stable Customer relationship owner; deliberately independent of Lead and Deal ownership.';
