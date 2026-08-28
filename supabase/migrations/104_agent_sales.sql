-- SegmiQ Sales Agent + Sales Command Center
-- Internal work commands for salespeople. Does not create a second quotation model.

ALTER TABLE public.agent_executions
  DROP CONSTRAINT IF EXISTS agent_executions_trigger_kind_check;

ALTER TABLE public.agent_executions
  ADD CONSTRAINT agent_executions_trigger_kind_check
  CHECK (trigger_kind IN ('INBOUND', 'PROACTIVE', 'SIMULATION', 'MANAGER', 'SALESPERSON'));

ALTER TABLE public.agent_executions
  DROP CONSTRAINT IF EXISTS agent_executions_state_check;

ALTER TABLE public.agent_executions
  ADD CONSTRAINT agent_executions_state_check
  CHECK (state IN (
    'QUEUED', 'RUNNING', 'WAITING_FOR_TOOL', 'WAITING_FOR_HUMAN',
    'WAITING_FOR_INPUT', 'WAITING_FOR_CONFIRMATION',
    'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED'
  ));

ALTER TABLE public.agent_executions
  ADD COLUMN IF NOT EXISTS sales_session_id uuid,
  ADD COLUMN IF NOT EXISTS requested_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE INDEX IF NOT EXISTS idx_agent_executions_sales
  ON public.agent_executions (client_id, created_at DESC)
  WHERE trigger_kind = 'SALESPERSON';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_executions_sales_idempotency
  ON public.agent_executions (client_id, requested_by_id, idempotency_key)
  WHERE trigger_kind = 'SALESPERSON'
    AND idempotency_key IS NOT NULL
    AND requested_by_id IS NOT NULL;

ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS sales_agent_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_agent_command_center boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_agent_sales_hub_command boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_agent_quotation_creation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_agent_quotation_update boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_agent_contextual_extraction boolean NOT NULL DEFAULT true;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS creation_source text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_creation_source_check;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_creation_source_check
  CHECK (creation_source IN ('MANUAL', 'SALES_AGENT', 'CUSTOMER_AGENT', 'IMPORT'));

CREATE TABLE IF NOT EXISTS public.agent_sales_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text,
  page_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  active_customer_id uuid,
  active_lead_id uuid,
  active_deal_id uuid,
  active_quotation_id uuid,
  active_conversation_id uuid,
  pending_input jsonb,
  result_set jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_sales_sessions_user
  ON public.agent_sales_sessions (client_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_sales_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_sales_sessions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_id uuid REFERENCES public.agent_executions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_sales_messages_session
  ON public.agent_sales_messages (session_id, created_at);

ALTER TABLE public.agent_sales_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sales_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agent_sales_sessions IS
  'Sales Command Center conversational context only. Canonical work remains in quotations, deals, and CRM tables.';
COMMENT ON COLUMN public.quotations.creation_source IS
  'How the quotation row was prepared. Does not change Lead source attribution.';
