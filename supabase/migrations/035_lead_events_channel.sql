-- 035_lead_events_channel.sql
-- Add channel to lead_events for contact logging parity (call vs whatsapp)

alter table if exists public.lead_events
  add column if not exists channel text;

-- Backfill: set channel = 'call' for existing CALL_LOGGED events where null
update public.lead_events
  set channel = 'call'
  where event_type = 'CALL_LOGGED' and channel is null;

-- Optional: no constraint for now; UI and server enforce allowed values ('call','whatsapp')
