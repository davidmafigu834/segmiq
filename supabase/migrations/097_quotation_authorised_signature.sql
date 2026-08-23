-- Authorised signatory for quotation PDFs. One company signature, drawn by a manager.

alter table public.quotation_settings
  add column if not exists authorised_signatory_name text,
  add column if not exists authorised_signatory_role text,
  add column if not exists authorised_signature_url text,
  add column if not exists authorised_signature_storage_key text;

comment on column public.quotation_settings.authorised_signature_url is
  'Public R2 URL of the manager-drawn authorised signature used on quotation documents.';
