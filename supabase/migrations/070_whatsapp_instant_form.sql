-- Link WhatsApp auto-qualification to a specific published Instant Form.

alter table public.clients
  add column if not exists whatsapp_instant_form_id uuid references public.instant_forms(id) on delete set null;

comment on column public.clients.whatsapp_instant_form_id is
  'Published Instant Form whose custom questions drive WhatsApp auto-qualification (contact fields skipped).';
