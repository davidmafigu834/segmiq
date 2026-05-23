-- 027_prospect_confirmation_setting.sql
-- Add toggle for automatic prospect confirmation WhatsApp

alter table clients
  add column if not exists send_prospect_confirmation boolean default true;
