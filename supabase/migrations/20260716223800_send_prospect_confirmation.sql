-- Ensure prospect confirmation toggle exists (migration 027 may not have been applied remotely).

alter table public.clients
  add column if not exists send_prospect_confirmation boolean default true;

comment on column public.clients.send_prospect_confirmation is
  'When true, send LEAD_CONFIRMATION_PROSPECT WhatsApp after form/Facebook lead capture.';
