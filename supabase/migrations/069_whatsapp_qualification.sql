-- WhatsApp auto-qualification (Instant Form style — skip name/phone, ask project questions).

alter table public.clients
  add column if not exists whatsapp_qualification_enabled boolean not null default true;

alter table public.clients
  add column if not exists whatsapp_qualification_questions jsonb;

comment on column public.clients.whatsapp_qualification_questions is
  'Optional JSON array of { id, label, maps_to, field_type, options? }. Omit name/phone/email — Meta provides those on WhatsApp inbound.';
