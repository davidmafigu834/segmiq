-- Conversation purpose, routing queue, and lightweight support cases.
-- These sit on the existing Lead-backed WhatsApp thread. They are not a second
-- messaging system and they are not Lead/Deal lifecycle states.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_conversation_type text NOT NULL DEFAULT 'SALES',
  ADD COLUMN IF NOT EXISTS whatsapp_queue text NOT NULL DEFAULT 'SALES',
  ADD COLUMN IF NOT EXISTS whatsapp_collaborator_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_whatsapp_conversation_type_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_whatsapp_conversation_type_check
  CHECK (whatsapp_conversation_type IN ('SALES', 'SUPPORT', 'GENERAL'));

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_whatsapp_queue_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_whatsapp_queue_check
  CHECK (whatsapp_queue IN ('SALES', 'SUPPORT'));

COMMENT ON COLUMN public.leads.whatsapp_conversation_type IS
  'Conversation purpose: SALES, SUPPORT, or GENERAL. Independent of Lead/Deal lifecycle.';
COMMENT ON COLUMN public.leads.whatsapp_queue IS
  'Internal routing queue: SALES or SUPPORT team.';
COMMENT ON COLUMN public.leads.whatsapp_collaborator_ids IS
  'Users kept on the thread after handover (internal collaboration only).';

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_type_queue
  ON public.leads (client_id, whatsapp_conversation_type, whatsapp_queue, updated_at DESC)
  WHERE source = 'WHATSAPP_INBOUND' AND (is_archived IS NULL OR is_archived = false);

CREATE TABLE IF NOT EXISTS public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED')),
  reason_category text
    CHECK (reason_category IS NULL OR reason_category IN (
      'TECHNICAL', 'INSTALLATION', 'WARRANTY', 'CUSTOMER_SERVICE', 'OTHER'
    )),
  reason text,
  notes text,
  opened_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_cases IS
  'Lightweight support case linked to a WhatsApp Lead thread. Not a helpdesk product.';

CREATE INDEX IF NOT EXISTS idx_support_cases_lead_open
  ON public.support_cases (lead_id, created_at DESC)
  WHERE status <> 'RESOLVED';

CREATE INDEX IF NOT EXISTS idx_support_cases_client
  ON public.support_cases (client_id, updated_at DESC);

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
