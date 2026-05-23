-- 029_form_opening_message.sql
-- Add opening message to form_schemas for conversational lead capture form.
-- form_title already exists in initial schema; only opening_message is new.

alter table form_schemas
  add column if not exists opening_message text
  default 'Hello! Thank you for considering us. We would love to learn more about what you are looking for so that our team can reach out to you with exactly the right information.';
