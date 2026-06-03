-- 034_clients_dial_code.sql
-- Add a dial_code column to clients for multi-country WhatsApp normalization

alter table public.clients
  add column if not exists dial_code text;

-- Default existing rows to Zimbabwe (263)
update public.clients
  set dial_code = coalesce(nullif(dial_code, ''), '263');
