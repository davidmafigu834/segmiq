-- Conversation workflow for the existing Lead-backed WhatsApp thread.
-- This deliberately does not create a second conversation/message system.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_conversation_status text NOT NULL DEFAULT 'OPEN'
    CHECK (whatsapp_conversation_status IN ('OPEN', 'RESOLVED')),
  ADD COLUMN IF NOT EXISTS whatsapp_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_resolved_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_company_whatsapp_queue
  ON public.leads (client_id, whatsapp_conversation_status, updated_at DESC)
  WHERE source = 'WHATSAPP_INBOUND' AND (is_archived IS NULL OR is_archived = false);

CREATE INDEX IF NOT EXISTS idx_leads_company_whatsapp_owner
  ON public.leads (client_id, assigned_to_id, updated_at DESC)
  WHERE source = 'WHATSAPP_INBOUND' AND (is_archived IS NULL OR is_archived = false);

-- One indexed aggregate for list/KPI projections. The UI never needs to pull a
-- company's complete message history just to render conversation rows.
CREATE OR REPLACE FUNCTION public.get_company_whatsapp_conversation_stats(
  p_client_id uuid,
  p_lead_ids uuid[]
)
RETURNS TABLE (
  lead_id uuid,
  last_body text,
  last_created_at timestamptz,
  last_message_type text,
  last_direction text,
  last_inbound_at timestamptz,
  first_inbound_at timestamptz,
  first_response_at timestamptz,
  message_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT wm.lead_id, wm.body, wm.message_type, wm.direction, wm.created_at
    FROM public.whatsapp_messages wm
    WHERE wm.client_id = p_client_id
      AND wm.lead_id = ANY (p_lead_ids)
  ),
  boundaries AS (
    SELECT
      s.lead_id,
      min(s.created_at) FILTER (WHERE s.direction = 'inbound') AS first_inbound_at,
      max(s.created_at) FILTER (WHERE s.direction = 'inbound') AS last_inbound_at,
      count(*) AS message_count
    FROM scoped s
    GROUP BY s.lead_id
  ),
  latest AS (
    SELECT DISTINCT ON (s.lead_id)
      s.lead_id,
      s.body,
      s.created_at,
      s.message_type,
      s.direction
    FROM scoped s
    ORDER BY s.lead_id, s.created_at DESC
  ),
  first_response AS (
    SELECT
      b.lead_id,
      min(s.created_at) FILTER (
        WHERE s.direction = 'outbound'
          AND b.first_inbound_at IS NOT NULL
          AND s.created_at >= b.first_inbound_at
      ) AS first_response_at
    FROM boundaries b
    LEFT JOIN scoped s ON s.lead_id = b.lead_id
    GROUP BY b.lead_id
  )
  SELECT
    b.lead_id,
    l.body AS last_body,
    l.created_at AS last_created_at,
    l.message_type AS last_message_type,
    l.direction AS last_direction,
    b.last_inbound_at,
    b.first_inbound_at,
    fr.first_response_at,
    b.message_count
  FROM boundaries b
  JOIN latest l ON l.lead_id = b.lead_id
  LEFT JOIN first_response fr ON fr.lead_id = b.lead_id;
$$;

REVOKE ALL ON FUNCTION public.get_company_whatsapp_conversation_stats(uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_whatsapp_conversation_stats(uuid, uuid[])
  TO service_role;
