-- Phase 6 conversations and company AI limits.
-- Tenant is stored on the row. The model cannot choose client_id.

ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS daily_ai_request_limit integer NOT NULL DEFAULT 400;

ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS monthly_ai_budget numeric;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  audience text NOT NULL CHECK (audience IN ('STAFF', 'PORTAL')),
  context_type text NOT NULL DEFAULT 'global',
  context_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_owner_idx
  ON public.ai_conversations (client_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx
  ON public.ai_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS ai_usage_events_client_created_idx
  ON public.ai_usage_events (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_action_log_client_created_idx
  ON public.ai_action_log (client_id, created_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
