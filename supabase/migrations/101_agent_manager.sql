-- SegmiQ Manager Agent + Command Center
-- Extends the existing Agent audit trail. Does not create a second CRM.

-- Manager executions are not lead-backed.
ALTER TABLE public.agent_executions
  ALTER COLUMN lead_id DROP NOT NULL;

ALTER TABLE public.agent_executions
  DROP CONSTRAINT IF EXISTS agent_executions_trigger_kind_check;

ALTER TABLE public.agent_executions
  ADD CONSTRAINT agent_executions_trigger_kind_check
  CHECK (trigger_kind IN ('INBOUND', 'PROACTIVE', 'SIMULATION', 'MANAGER'));

ALTER TABLE public.agent_executions
  ADD COLUMN IF NOT EXISTS manager_session_id uuid,
  ADD COLUMN IF NOT EXISTS manager_feedback jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_executions_manager
  ON public.agent_executions (client_id, created_at DESC)
  WHERE trigger_kind = 'MANAGER';

CREATE TABLE IF NOT EXISTS public.agent_manager_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text,
  page_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_set jsonb,
  pending_confirmation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_manager_sessions_user
  ON public.agent_manager_sessions (client_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_manager_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_manager_sessions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_id uuid REFERENCES public.agent_executions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_manager_messages_session
  ON public.agent_manager_messages (session_id, created_at);

CREATE TABLE IF NOT EXISTS public.agent_manager_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.agent_manager_sessions(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  entity_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'STALE')),
  idempotency_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_manager_confirmations_pending
  ON public.agent_manager_confirmations (user_id, status, expires_at)
  WHERE status = 'PENDING';

ALTER TABLE public.agent_manager_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_manager_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_manager_confirmations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agent_manager_sessions IS
  'Command Center threads. Persistent business state remains in CRM; this is conversational context only.';
COMMENT ON TABLE public.agent_manager_confirmations IS
  'Short-lived high-risk action previews. Revalidated on confirm. Natural language never bypasses this.';
