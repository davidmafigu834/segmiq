-- 049_clients_assignment_mode.sql
-- Customer Hub: per-client lead assignment mode for manual adds.
-- direct       = manager picks the assignee (or salesperson self-assigns)
-- pool         = lead is unassigned and claimable by anyone on the team
-- round_robin  = auto-assigned to the salesperson with the lightest open load
-- Additive only. Defaults all existing clients to 'direct'.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'direct'
  CHECK (assignment_mode IN ('direct','pool','round_robin'));
