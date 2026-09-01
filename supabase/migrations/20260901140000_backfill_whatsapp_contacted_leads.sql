-- Backfill: WhatsApp (and call) outreach should promote NEW → CONTACTED.
-- Forward path: markLeadContactedIfNew on human outbound; this fixes historical rows.

UPDATE public.leads l
SET
  status = 'CONTACTED',
  updated_at = GREATEST(l.updated_at, NOW())
WHERE l.status = 'NEW'
  AND (
    EXISTS (
      SELECT 1
      FROM public.whatsapp_messages wm
      WHERE wm.lead_id = l.id
        AND wm.direction = 'outbound'
    )
    OR EXISTS (
      SELECT 1
      FROM public.call_logs cl
      WHERE cl.lead_id = l.id
        AND cl.outcome = 'reached'
    )
    OR EXISTS (
      SELECT 1
      FROM public.lead_events le
      WHERE le.lead_id = l.id
        AND le.event_type IN ('MESSAGE_SENT', 'CALL_LOGGED')
    )
  );
