-- Lock down public.agency_settings: RLS was documented in schema.sql but never
-- applied via migration, leaving the singleton readable/writable via the Data API
-- with the anon key. App access is service-role only (createAdminClient).

alter table public.agency_settings enable row level security;

revoke all on table public.agency_settings from anon, authenticated;
grant select, insert, update, delete on table public.agency_settings to service_role;

comment on table public.agency_settings is
  'Platform singleton agency settings. Service-role only; no anon/authenticated policies.';
