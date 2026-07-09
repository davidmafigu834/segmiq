-- 058_restore_round_robin_assignment.sql
-- Migration 049 defaulted all clients to 'direct', which stopped automatic round-robin
-- assignment for Facebook, landing page, and WhatsApp inbound leads.
-- Restore round_robin for clients that have at least one active salesperson.

UPDATE public.clients c
SET assignment_mode = 'round_robin',
    updated_at = now()
WHERE c.assignment_mode = 'direct'
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.client_id = c.id
      AND u.role = 'SALESPERSON'
      AND u.is_active = true
  );

ALTER TABLE public.clients
  ALTER COLUMN assignment_mode SET DEFAULT 'round_robin';
